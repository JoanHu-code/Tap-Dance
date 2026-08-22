import { useDatabase } from '../../../../utils/db.js'
import { requireTeacherOrganization } from '../../../../utils/teacherAuth.js'

export default defineEventHandler(async (event) => {
  const { organization } = await requireTeacherOrganization(event)
  const studentId = getRouterParam(event, 'id')
  const sql = useDatabase()
  const students = await sql`SELECT id,name,phone,note,status FROM students WHERE id=${studentId} AND organization_id=${organization.id} LIMIT 1`
  if (!students.length) throw createError({ statusCode: 404, statusMessage: '找不到學生' })
  const packages = await sql`
    SELECT sp.*, dc.name AS course_name,
      COUNT(ar.id) FILTER (WHERE ar.status='ATTENDED')::INTEGER AS attended_count,
      COUNT(ar.id) FILTER (WHERE ar.status='LEAVE')::INTEGER AS leave_count
    FROM student_packages sp JOIN dance_courses dc ON dc.id=sp.course_id
    LEFT JOIN attendance_records_v2 ar ON ar.package_id=sp.id
    WHERE sp.student_id=${studentId}
    GROUP BY sp.id,dc.name ORDER BY sp.created_at DESC
  `
  const records = await sql`
    SELECT ar.*, cs.class_date, cs.start_time, dc.name AS course_name
    FROM attendance_records_v2 ar
    JOIN class_sessions cs ON cs.id=ar.session_id
    JOIN class_schedules sch ON sch.id=cs.schedule_id
    JOIN dance_courses dc ON dc.id=sch.course_id
    WHERE ar.student_id=${studentId}
    ORDER BY cs.class_date DESC, cs.start_time DESC LIMIT 200
  `
  return { student: students[0], packages, records }
})
