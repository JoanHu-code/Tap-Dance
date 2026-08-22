import { useDatabase } from '../../server/utils/db.js'

export default defineEventHandler(
  async () => {
    const sql =
      useDatabase()

    const courses =
      await sql`
        SELECT
          id,
          name,
          teacher_name,
          total_sessions,
          price
        FROM courses
        ORDER BY created_at ASC
      `

    return {
      success: true,
      courses,
    }
  }
)