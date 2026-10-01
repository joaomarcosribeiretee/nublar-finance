-- Existing users get the new starter categories too. Names they already
-- have (in any case they renamed nothing) are left alone.
INSERT INTO "Category" ("id", "userId", "name", "kind", "updatedAt")
SELECT gen_random_uuid(), u."id", c."name", c."kind"::"CategoryKind", CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN (VALUES
  ('Salário', 'INCOME'),
  ('Freelance', 'INCOME'),
  ('Rendimentos', 'INCOME'),
  ('Reembolsos', 'INCOME'),
  ('Presentes recebidos', 'INCOME'),
  ('Outras receitas', 'INCOME'),
  ('Mercado', 'EXPENSE'),
  ('Alimentação', 'EXPENSE'),
  ('Restaurantes e delivery', 'EXPENSE'),
  ('Moradia', 'EXPENSE'),
  ('Contas da casa', 'EXPENSE'),
  ('Transporte', 'EXPENSE'),
  ('Combustível', 'EXPENSE'),
  ('Saúde', 'EXPENSE'),
  ('Farmácia', 'EXPENSE'),
  ('Educação', 'EXPENSE'),
  ('Lazer', 'EXPENSE'),
  ('Viagens', 'EXPENSE'),
  ('Compras', 'EXPENSE'),
  ('Vestuário', 'EXPENSE'),
  ('Beleza e cuidados', 'EXPENSE'),
  ('Assinaturas', 'EXPENSE'),
  ('Pets', 'EXPENSE'),
  ('Presentes', 'EXPENSE'),
  ('Seguros', 'EXPENSE'),
  ('Impostos e taxas', 'EXPENSE'),
  ('Tarifas bancárias', 'EXPENSE'),
  ('Doações', 'EXPENSE'),
  ('Outros', 'EXPENSE')
) AS c("name", "kind")
ON CONFLICT ("userId", "kind", "name") DO NOTHING;
