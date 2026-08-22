import { useDatabase } from '../../utils/db.js'
import { createAuthSession } from '../../utils/authSession.js'

const publicUser = (user) => ({
  id: user.id,
  displayName: user.display_name,
  pictureUrl: user.picture_url,
  role: user.role,
})


export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const idToken = String(body?.idToken || '').trim()
  const linkCode = String(body?.linkCode || '').trim()
  if (!idToken) throw createError({ statusCode: 400, statusMessage: '缺少 LINE ID Token' })

  const config = useRuntimeConfig()
  if (!config.lineChannelId) throw createError({ statusCode: 500, statusMessage: '尚未設定 LINE_CHANNEL_ID' })

  const form = new URLSearchParams({ id_token: idToken, client_id: config.lineChannelId })
  let lineUser
  try {
    lineUser = await $fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString(),
    })
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'LINE 驗證失敗，請重新登入' })
  }
  if (lineUser.iss !== 'https://access.line.me' || String(lineUser.aud) !== String(config.lineChannelId) || !lineUser.sub) {
    throw createError({ statusCode: 401, statusMessage: 'LINE Token 無效' })
  }

  const sql = useDatabase()
  let users = await sql`SELECT id, display_name, picture_url, role, status FROM app_users WHERE line_user_id=${lineUser.sub} LIMIT 1`

  // A manual student has no user_id. They can claim only the one-time code in
  // the URL supplied by the teacher; names alone are deliberately never used.
  if (!users.length && linkCode) {
    const students = await sql`
      SELECT id FROM students WHERE line_link_code=${linkCode} AND user_id IS NULL AND status='ACTIVE' LIMIT 1
    `
    if (!students.length) throw createError({ statusCode: 409, statusMessage: '此學生連結已失效或已使用' })
    users = await sql`
      INSERT INTO app_users(line_user_id, display_name, picture_url, role, status, last_login_at)
      VALUES (${lineUser.sub}, ${lineUser.name || null}, ${lineUser.picture || null}, 'STUDENT', 'ACTIVE', NOW())
      RETURNING id, display_name, picture_url, role, status
    `
    await sql`UPDATE students SET user_id=${users[0].id}, line_link_code=NULL, updated_at=NOW() WHERE id=${students[0].id}`
  }

  if (!users.length) {
    await sql`
      INSERT INTO app_users(line_user_id, display_name, picture_url, status, last_login_at)
      VALUES (${lineUser.sub}, ${lineUser.name || null}, ${lineUser.picture || null}, 'PENDING', NOW())
    `
    return { success: false, authorized: false, status: 'PENDING', message: '此 LINE 帳號尚未與學生資料連結，請使用老師提供的學生連結登入。' }
  }

  const user = users[0]
  await sql`UPDATE app_users SET display_name=${lineUser.name || user.display_name}, picture_url=${lineUser.picture || user.picture_url}, last_login_at=NOW(), updated_at=NOW() WHERE id=${user.id}`
  if (user.status !== 'ACTIVE') return { success: false, authorized: false, status: user.status, message: '帳號尚未啟用，請聯絡老師。' }

  await createAuthSession(event, user.id)
  return { success: true, authorized: true, user: publicUser({ ...user, display_name: lineUser.name || user.display_name, picture_url: lineUser.picture || user.picture_url }) }
})
