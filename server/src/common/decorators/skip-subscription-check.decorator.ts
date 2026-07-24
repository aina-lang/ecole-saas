import { SetMetadata } from '@nestjs/common';

export const SKIP_SUBSCRIPTION_CHECK = 'skipSubscriptionCheck';

/** Exempte une route du blocage "abonnement en retard" (lecture seule) — à
 * poser sur le module Billing lui-même, pour qu'un tenant en PAST_DUE puisse
 * toujours consulter son statut et payer. */
export const SkipSubscriptionCheck = () => SetMetadata(SKIP_SUBSCRIPTION_CHECK, true);
