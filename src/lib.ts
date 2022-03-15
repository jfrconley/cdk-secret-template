import { isObject, mapValues } from 'lodash'

export type FlattenObject<T> = {
  [key in keyof T]:
    T[key] extends object ? FlattenObject<T[key]> :
      T[key]
}[keyof T]

export type ObjectAny<T> = {
  [key in keyof T]:
  T[key] extends object ? FlattenObject<T[key]> :
    any
}

export const mapValuesDeep = <T, K>(obj: T, iteratee: (input: FlattenObject<T>) => any ): ObjectAny<T> => isObject(obj) ? mapValues(obj as any, v => mapValuesDeep(v, iteratee as any) as any) : iteratee(obj as any)
