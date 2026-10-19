-- Garantir que somente um super administrador possa existir.
-- Aplicar após a migração inicial; falhará se já existirem superadmins duplicados.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_super_admin
ON users(role) WHERE role = 'super_admin';
