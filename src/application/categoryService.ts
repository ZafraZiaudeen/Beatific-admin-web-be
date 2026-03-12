import { Category } from '../domain/models/Category'
import { ICategory, ISubcategory } from '../domain/interfaces/ICategory'

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export interface CreateCategoryDto {
  name: string
  slug?: string
  icon?: string
  color?: string
  itemType: string
  subcategories?: { name: string; slug?: string }[]
  isDefault?: boolean
  order?: number
}

export interface UpdateCategoryDto {
  name?: string
  slug?: string
  icon?: string
  color?: string
  subcategories?: { name: string; slug?: string }[]
  isDefault?: boolean
  order?: number
}

export class CategoryService {
  async create(dto: CreateCategoryDto): Promise<ICategory> {
    const slug = dto.slug ?? toSlug(dto.name)
    const subcategories: ISubcategory[] = (dto.subcategories ?? []).map(s => ({
      name: s.name,
      slug: s.slug ?? toSlug(s.name),
    }))
    const category = new Category({ ...dto, slug, subcategories })
    return category.save()
  }

  async list(itemType?: string): Promise<ICategory[]> {
    const filter = itemType ? { itemType } : {}
    return Category.find(filter).sort({ order: 1, createdAt: 1 }).lean() as Promise<ICategory[]>
  }

  async getById(id: string): Promise<ICategory | null> {
    return Category.findById(id)
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<ICategory | null> {
    const update: Record<string, unknown> = { ...dto }
    if (dto.name && !dto.slug) update.slug = toSlug(dto.name)
    if (dto.subcategories) {
      update.subcategories = dto.subcategories.map(s => ({
        name: s.name,
        slug: s.slug ?? toSlug(s.name),
      }))
    }
    return Category.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
  }

  async addSubcategory(id: string, sub: { name: string; slug?: string }): Promise<ICategory | null> {
    const subcategory = { name: sub.name, slug: sub.slug ?? toSlug(sub.name) }
    return Category.findByIdAndUpdate(
      id,
      { $push: { subcategories: subcategory } },
      { new: true }
    )
  }

  async removeSubcategory(id: string, slug: string): Promise<ICategory | null> {
    return Category.findByIdAndUpdate(
      id,
      { $pull: { subcategories: { slug } } },
      { new: true }
    )
  }

  async delete(id: string): Promise<boolean> {
    const result = await Category.findByIdAndDelete(id)
    return result !== null
  }
}
