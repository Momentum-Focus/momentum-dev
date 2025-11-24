import { SetMetadata } from '@nestjs/common';

export const FEATURES_KEY = 'requiredFeatures';

export const RequireFeatures = (...features: string[]) =>
  SetMetadata(FEATURES_KEY, features);


