import { useDatabase } from '../../utils/db.js'
import { requireAuth } from '../../utils/authSession.js'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  if (user.role !== 'STUDENT') throw createError({ statusCode: 403, statusMessage: '此頁面僅供學生使用' })
  const sql = useDatabase()
  const students = await sql`SELECT id, name FROM students WHERE user_id=${user.id} AND status='ACTIVE' LIMIT 1`
  if (!students.length) throw createError({ statusCode: 404, statusMessage: '尚未連結學生資料' })
  const student = students[0]
  const courses = await sql`
    SELECT dc.id, dc.name, sp.id AS package_id, sp.start_date, sp.total_sessions, sp.price, sp.status AS package_status,
      COUNT(ar.id) FILTER (WHERE ar.status='ATTENDED')::INTEGER AS attended_count
    FROM student_enrollments se
    JOIN dance_courses dc ON dc.id=se.course_id
    LEFT JOIN student_packages sp ON sp.student_id=${student.id} AND sp.course_id=dc.id AND sp.status='ACTIVE'
    LEFT JOIN attendance_records_v2 ar ON ar.package_id=sp.id
    WHERE se.student_id=${student.id} AND se.status='ACTIVE'
    GROUP BY dc.id, sp.id
    ORDER BY dc.name
  `
  const records = await sql`
    SELECT ar.id, ar.status, ar.attendance_type, ar.note, cs.class_date, cs.start_time, cs.status AS session_status,
      dc.name AS course_name
    FROM attendance_records_v2 ar
    JOIN class_sessions cs ON cs.id=ar.session_id
    JOIN class_schedules sch ON sch.id=cs.schedule_id
    JOIN dance_courses dc ON dc.id=sch.course_id
    WHERE ar.student_id=${student.id}
    ORDER BY cs.class_date DESC, cs.start_time DESC
    LIMIT 100
  `
  const notices = await sql`
    SELECT cs.id, cs.class_date, cs.start_time, cs.teacher_note, dc.name AS course_name
    FROM class_sessions cs
    JOIN class_schedules sch ON sch.id=cs.schedule_id
    JOIN dance_courses dc ON dc.id=sch.course_id
    JOIN student_enrollments se ON se.course_id=dc.id AND se.student_id=${student.id} AND se.status='ACTIVE'
    WHERE cs.status='TEACHER_LEAVE' AND cs.class_date >= CURRENT_DATE
    ORDER BY cs.class_date, cs.start_time
  `
  return { student: { id: student.id, name: student.name }, courses, records, teacherLeaveNotices: notices }
})
