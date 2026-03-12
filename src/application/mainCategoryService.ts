import { MainCategory } from '../domain/models/MainCategory'
import { Category } from '../domain/models/Category'
import { IMainCategory } from '../domain/interfaces/IMainCategory'

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export interface CreateMainCategoryDto {
  name: string
  slug?: string
  icon?: string
  color?: string
  order?: number
}

export interface UpdateMainCategoryDto {
  name?: string
  slug?: string
  icon?: string
  color?: string
  order?: number
}

export class MainCategoryService {
  async create(dto: CreateMainCategoryDto): Promise<IMainCategory> {
    const slug = dto.slug ?? toSlug(dto.name)
    const mainCat = new MainCategory({ ...dto, slug })
    return mainCat.save()
  }

  async list(): Promise<IMainCategory[]> {
    return MainCategory.find({}).sort({ order: 1, createdAt: 1 }).lean() as Promise<IMainCategory[]>
  }

  async getById(id: string): Promise<IMainCategory | null> {
    return MainCategory.findById(id)
  }

  async getBySlug(slug: string): Promise<IMainCategory | null> {
    return MainCategory.findOne({ slug })
  }

  async update(id: string, dto: UpdateMainCategoryDto): Promise<IMainCategory | null> {
    const update: Record<string, unknown> = { ...dto }
    if (dto.name && !dto.slug) update.slug = toSlug(dto.name)
    return MainCategory.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
  }

  async delete(id: string): Promise<boolean> {
    const mainCat = await MainCategory.findById(id)
    if (!mainCat) return false

    await Category.deleteMany({ itemType: mainCat.slug })

    await MainCategory.findByIdAndDelete(id)
    return true
  }

 
  async ensureExists(slug: string, name?: string): Promise<IMainCategory> {
    const existing = await MainCategory.findOne({ slug })
    if (existing) return existing
    return this.create({ name: name ?? slug, slug })
  }
}
