import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Preferences, UpdatePreferencesInput } from "@nublar/validation";
import { api } from "@/lib/api";
import { applyPreferences, cachePreferences, readCachedPreferences } from "@/lib/preferences";

const queryKey = ["preferences"] as const;
const mutationKey = ["preferences", "update"] as const;

/**
 * The user's preferences. Starts from the local cache (never undefined) and
 * refreshes from the API; changes show at once and roll back if saving fails.
 */
export function usePreferences() {
  const client = useQueryClient();

  const query = useQuery({
    queryKey,
    queryFn: () => api<Preferences>("/me/preferences"),
    initialData: () => readCachedPreferences(),
    // The cache is only a head start: always confirm with the API.
    initialDataUpdatedAt: 0,
  });

  const mutation = useMutation({
    mutationKey,
    mutationFn: (patch: UpdatePreferencesInput) =>
      api<Preferences>("/me/preferences", { method: "PATCH", body: JSON.stringify(patch) }),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<Preferences>(queryKey);
      if (previous) {
        client.setQueryData<Preferences>(queryKey, { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        client.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      // A later change still in flight would be overwritten by this refetch.
      if (client.isMutating({ mutationKey }) === 1) {
        return client.invalidateQueries({ queryKey });
      }
    },
  });

  const preferences = query.data;
  useEffect(() => {
    applyPreferences(preferences);
    cachePreferences(preferences);
  }, [preferences]);

  return {
    preferences,
    update: mutation.mutate,
    isSaving: mutation.isPending,
    error: query.error ?? mutation.error,
  };
}
