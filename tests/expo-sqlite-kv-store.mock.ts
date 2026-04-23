export class SQLiteStorage {
  getItemAsync = jest.fn().mockResolvedValue(null);
  setItemAsync = jest.fn().mockResolvedValue(undefined);
}
