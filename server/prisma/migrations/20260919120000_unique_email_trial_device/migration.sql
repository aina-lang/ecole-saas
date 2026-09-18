-- L'e-mail est l'identifiant de connexion et la connexion le cherche sans
-- connaître l'établissement : il doit être unique sur toute la plateforme,
-- pas seulement par établissement. Vérifié avant migration : aucun doublon
-- en production, aucun e-mail en majuscules (l'application normalise en
-- minuscules à l'écriture).

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Un seul essai gratuit par ordinateur : empreinte de la machine qui a créé
-- l'établissement. NULL pour les établissements créés avant cette règle.

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "registrationDeviceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_registrationDeviceId_key" ON "tenants"("registrationDeviceId");
