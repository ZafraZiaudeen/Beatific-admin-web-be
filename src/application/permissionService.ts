import { Permission, IPermission } from '../domain/models/Permission'

export class PermissionService {
  async list(scope?: string): Promise<IPermission[]> {
    const filter = scope ? { scope } : {}
    return Permission.find(filter).sort({ targetType: 1 }).lean() as Promise<IPermission[]>
  }

  async get(scope: string, targetType: string): Promise<IPermission | null> {
    return Permission.findOne({ scope, targetType }).lean() as Promise<IPermission | null>
  }

  async upsert(scope: string, targetType: string, data: Partial<IPermission>): Promise<IPermission> {
    const result = await Permission.findOneAndUpdate(
      { scope, targetType },
      { $set: { ...data, scope, targetType } },
      { returnDocument: 'after', upsert: true, runValidators: true }
    )
    return result as IPermission
  }

  async bulkUpsert(permissions: Array<{
    scope: string
    targetType: string
    enabled: boolean
    placementRole?: 'primary' | 'secondary' | null
    allowedCategories?: string[]
    allowedItems?: string[]
  }>): Promise<IPermission[]> {
    const results: IPermission[] = []
    for (const perm of permissions) {
      const result = await Permission.findOneAndUpdate(
        { scope: perm.scope, targetType: perm.targetType },
        { $set: perm },
        { returnDocument: 'after', upsert: true, runValidators: true }
      )
      results.push(result as IPermission)
    }
    return results
  }

  async delete(scope: string, targetType: string): Promise<boolean> {
    const result = await Permission.findOneAndDelete({ scope, targetType })
    return result !== null
  }
}

export const permissionService = new PermissionService()
