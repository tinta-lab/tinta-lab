export type TintaEntityType =
  | 'light'
  | 'climate'
  | 'security'
  | 'switch'
  | 'cover';

export interface TintaCommand {
  entityType: TintaEntityType;
  haEntityId: string;
  action: string;
  data?: Record<string, any>;
}
