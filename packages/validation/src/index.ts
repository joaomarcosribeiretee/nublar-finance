import { INITIAL_CURRENCY } from "@nublar/types";
import { z } from "zod";

export const currencyCodeSchema = z.literal(INITIAL_CURRENCY);

/**
 * Integer amount in the currency minor unit (centavos for BRL).
 * Decimal strings such as "1234.56" are rejected.
 */
export const moneyAmountSchema = z
  .string()
  .regex(/^-?\d+$/, "Amount must be an integer in minor units")
  .transform((value) => BigInt(value));

export const serviceHealthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.literal("nublar-api"),
  database: z.enum(["up", "down"]),
});

export type ServiceHealth = z.infer<typeof serviceHealthSchema>;
