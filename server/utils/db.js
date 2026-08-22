import { neon } from '@neondatabase/serverless'

let sql = null

export const useDatabase = () => {
  if (sql) {
    return sql
  }

  const databaseUrl =
    process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      '找不到 DATABASE_URL 環境變數'
    )
  }

  sql = neon(databaseUrl)

  return sql
}