import { useDatabase } from '../../../../utils/db.js'
import { requireTeacherOrganization } from '../../../../utils/teacherAuth.js'
export default defineEventHandler(async (event) => {
  const { organization } = await requireTeacherOrganization(event)
  const body = await readBody(event)
  const studentId = String(body?.studentId || '')
  const courseId = String(body?.courseId || '')
  const scheduleId = body?.scheduleId ? String(body.scheduleId) : null
  if (!studentId || !courseId) throw createError({ statusCode: 400, statusMessage: '請選擇學生與課程' })
  const sql = useDatabase()
  const valid = await sql`SELECT s.id FROM students s JOIN dance_courses dc ON dc.organization_id=s.organization_id WHERE s.id=${studentId} AND dc.id=${courseId} AND s.organization_id=${organization.id} LIMIT 1`
  if (!valid.length) throw createError({ statusCode: 404, statusMessage: '找不到學生或課程' })
  if (scheduleId) {
    const schedules = await sql`SELECT id FROM class_schedules WHERE id=${scheduleId} AND course_id=${courseId} LIMIT 1`
    if (!schedules.length) throw createError({ statusCode: 400, statusMessage: '時段不屬於此課程' })
  }
  const records = await sql`INSERT INTO student_enrollments(student_id,course_id,default_schedule_id,status) VALUES (${studentId},${courseId},${scheduleId},'ACTIVE') ON CONFLICT(student_id,course_id) DO UPDATE SET default_schedule_id=EXCLUDED.default_schedule_id,status='ACTIVE' RETURNING *`
  return { success: true, enrollment: records[0] }
})
