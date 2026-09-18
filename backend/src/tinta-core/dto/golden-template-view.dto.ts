import { GoldenTemplate } from '../entities/golden-template.entity';

// Response shape for GET/POST /tinta-core/templates (ADMIN-only). No column
// on GoldenTemplate is secret/internal — this exists to decouple the HTTP
// contract from the entity class itself (so a future entity column doesn't
// silently become an API field with no contract review), not to trim
// anything: every field here, including `automation`, is kept even though
// the one current frontend consumer (admin/hubs/page.tsx's templates tab)
// only reads id/slug/name/description/requiredEntities/isActive — the
// automation definition is core template data, not incidental noise.
export class GoldenTemplateViewDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  automation: Record<string, unknown>;
  requiredEntities: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toGoldenTemplateView(
  template: GoldenTemplate,
): GoldenTemplateViewDto {
  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    description: template.description,
    automation: template.automation,
    requiredEntities: template.requiredEntities,
    isActive: template.isActive,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}
