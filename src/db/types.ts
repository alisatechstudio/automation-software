export interface AppCollection<T = any> {
  createIndex(keys: any, options?: any): Promise<string>;
  findOne(filter?: any, options?: { sort?: any }): Promise<T | null>;
  find(filter?: any): {
    project(projObj: any): any;
    sort(sortObj: any): any;
    limit(num: number): any;
    skip(num: number): any;
    toArray(): Promise<T[]>;
  };
  countDocuments(filter?: any): Promise<number>;
  insertOne(doc: any): Promise<{ insertedId: string; acknowledged: boolean }>;
  insertMany(docs: any[]): Promise<{ insertedCount: number; acknowledged: boolean }>;
  updateOne(filter: any, update: any, options?: { upsert?: boolean }): Promise<any>;
  updateMany(filter: any, update: any): Promise<any>;
  deleteOne(filter: any): Promise<any>;
  deleteMany(filter: any): Promise<any>;
  findOneAndUpdate(
    filter: any,
    update: any,
    options?: { sort?: any; returnDocument?: 'before' | 'after'; upsert?: boolean }
  ): Promise<T | null>;
  aggregate<R = any>(pipeline: any[]): { toArray(): Promise<R[]> };
}

export interface AppDatabase {
  collection<T = any>(name: string): AppCollection<T>;
  command(cmd: any): Promise<any>;
}
