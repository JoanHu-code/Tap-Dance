<script setup>
definePageMeta({
  middleware:
    'student-auth',
})

// ============================================================
// State
// ============================================================

const loading =
  ref(true)

const errorMessage =
  ref('')

const authStore =
  useAuthStore()

const {
  $liff,
} =
  useNuxtApp()

const dashboard =
  ref({
    today: '',
    student: null,
    courses: [],
    nextSession: null,
    pendingMakeups: [],
    recentLeaves: [],
    recentMakeups: [],
    recentAudit: [],
  })

// ============================================================
// Date
// ============================================================

const formatDate = (
  value
) => {
  return value
    ? String(
        value
      ).slice(
        0,
        10
      )
    : '-'
}

// ============================================================
// Time
// ============================================================

const formatTime = (
  value
) => {
  return String(
    value || ''
  ).slice(
    0,
    5
  )
}

// ============================================================
// DateTime
// ============================================================

const formatDateTime = (
  value
) => {
  if (!value) {
    return '-'
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(
      value
    )
  }

  return new Intl
    .DateTimeFormat(
      'zh-TW',
      {
        timeZone:
          'Asia/Taipei',

        month:
          '2-digit',

        day:
          '2-digit',

        hour:
          '2-digit',

        minute:
          '2-digit',

        hourCycle:
          'h23',
      }
    )
    .format(
      date
    )
}

// ============================================================
// Weekday
// ============================================================

const getWeekdayLabel = (
  value
) => {
  const map = {
    1: '星期一',
    2: '星期二',
    3: '星期三',
    4: '星期四',
    5: '星期五',
    6: '星期六',
    7: '星期日',
  }

  return (
    map[
      Number(
        value
      )
    ] ||
    ''
  )
}

// ============================================================
// Action
// ============================================================

const getActionLabel = (
  value
) => {
  const map = {
    CREATE: '新增',
    UPDATE: '修改',
    CANCEL: '取消',
    RESTORE: '恢復',
    RENEW: '續期',
    LINK: '綁定',
    UNLINK: '解除綁定',
  }

  return (
    map[value] ||
    value ||
    '-'
  )
}

// ============================================================
// Entity
// ============================================================

const getEntityLabel = (
  value
) => {
  const map = {
    ATTENDANCE: '出席',
    LEAVE: '請假',
    MAKEUP: '補課',
    PACKAGE: '方案',
    SESSION: '課堂',
    ENROLLMENT: '選課',
    STUDENT: '學生',
    USER: '帳號',
  }

  return (
    map[value] ||
    value ||
    '-'
  )
}

// ============================================================
// Actor
// ============================================================

const getActorLabel = (
  value
) => {
  if (
    value ===
    'STUDENT'
  ) {
    return '我'
  }

  if (
    value ===
    'TEACHER'
  ) {
    return '老師'
  }

  return '系統'
}

// ============================================================
// Fetch
// ============================================================

const fetchDashboard =
  async () => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/student/dashboard'
        )

      dashboard.value =
        response.dashboard ||
        dashboard.value
    } catch (error) {
      console.error(
        'Student Dashboard 載入失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '首頁資料載入失敗'
    } finally {
      loading.value =
        false
    }
  }

// ============================================================
// LIFF Login
//
// 將 LINE 的 LIFF 登入轉換成後端的 httpOnly Session Cookie。
// ============================================================

const authenticate =
  async () => {
    const existingSession =
      await authStore
        .fetchStudentMe({
          force: true,
        })

    if (
      existingSession
        ?.success
    ) {
      return true
    }

    const loggedIn =
      await $liff
        .login(
          'STUDENT'
        )

    if (!loggedIn) {
      return false
    }

    const idToken =
      await $liff
        .getIdToken(
          'STUDENT'
        )

    if (!idToken) {
      throw new Error(
        '無法取得 LINE 登入憑證，請重新開啟學生入口。'
      )
    }

    await $fetch(
      '/api/auth/student/line',
      {
        method: 'POST',

        body: {
          idToken,
        },
      }
    )

    const session =
      await authStore
        .fetchStudentMe({
          force: true,
        })

    if (
      !session?.success
    ) {
      throw new Error(
        '登入 Session 建立失敗，請重新開啟學生入口。'
      )
    }

    return true
  }

// ============================================================
// Lifecycle
// ============================================================

onMounted(
  async () => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      if (
        await authenticate()
      ) {
        await fetchDashboard()
      }
    } catch (error) {
      console.error(
        'Student LIFF 登入失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        'LINE 登入失敗，請重新開啟學生入口。'

      loading.value =
        false
    }
  }
)
</script>

<template>
  <main class="student-dashboard">
    <div class="container">
      <!-- ====================================================
           Header
           ==================================================== -->

      <header class="page-header">
        <div>
          <span>
            My Courses
          </span>

          <h1>
            {{
              dashboard.student
                ?.name
            }}
          </h1>

          <p>
            {{
              dashboard.today
            }}
          </p>
        </div>

        <button
          type="button"
          class="refresh-button"
          :disabled="
            loading
          "
          @click="
            fetchDashboard
          "
        >
          {{
            loading
              ? '更新中'
              : '更新'
          }}
        </button>
      </header>

      <!-- ====================================================
           Error
           ==================================================== -->

      <div
        v-if="
          errorMessage
        "
        class="error-message"
      >
        {{ errorMessage }}
      </div>

      <!-- ====================================================
           Navigation
           ==================================================== -->

      <nav class="navigation-grid">
        <NuxtLink
          to="/student/attendance"
        >
          <span>
            Attendance
          </span>

          <strong>
            簽到紀錄
          </strong>
        </NuxtLink>

        <NuxtLink
          to="/student/leave"
        >
          <span>
            Leave
          </span>

          <strong>
            我要請假
          </strong>
        </NuxtLink>

        <NuxtLink
          to="/student/makeup"
        >
          <span>
            Makeup
          </span>

          <strong>
            我的補課
          </strong>
        </NuxtLink>

        <NuxtLink
          to="/student/audit"
          class="audit-link"
        >
          <span>
            My Timeline
          </span>

          <strong>
            我的操作紀錄
          </strong>
        </NuxtLink>
      </nav>

      <!-- ====================================================
           Next Session
           ==================================================== -->

      <section class="section">
        <div class="section-title">
          <span>
            Next Class
          </span>

          <h2>
            下一堂課
          </h2>
        </div>

        <article
          v-if="
            dashboard.nextSession
          "
          class="next-card"
        >
          <div>
            <strong>
              {{
                dashboard
                  .nextSession
                  .course_name
              }}
            </strong>

            <span>
              {{
                dashboard
                  .nextSession
                  .schedule_name
              }}
            </span>

            <small
              v-if="
                dashboard
                  .nextSession
                  .is_fixed_schedule
              "
            >
              固定上課時段
            </small>
          </div>

          <div class="next-time">
            <strong>
              {{
                formatDate(
                  dashboard
                    .nextSession
                    .class_date
                )
              }}
            </strong>

            <span>
              {{
                formatTime(
                  dashboard
                    .nextSession
                    .start_time
                )
              }}
              -
              {{
                formatTime(
                  dashboard
                    .nextSession
                    .end_time
                )
              }}
            </span>
          </div>
        </article>

        <div
          v-else
          class="empty-state"
        >
          目前沒有下一堂課。
        </div>
      </section>

      <!-- ====================================================
           Courses
           ==================================================== -->

      <section class="section">
        <div class="section-title">
          <span>
            Courses
          </span>

          <h2>
            我的課程
          </h2>
        </div>

        <div
          v-if="
            dashboard.courses
              .length
          "
          class="course-list"
        >
          <article
            v-for="
              course in
                dashboard.courses
            "
            :key="
              course.id
            "
            class="course-card"
          >
            <header>
              <div>
                <span>
                  Course
                </span>

                <h3>
                  {{
                    course.course_name
                  }}
                </h3>
              </div>

              <span
                v-if="
                  course.canRenew
                "
                class="renew-badge"
              >
                可續期
              </span>
            </header>

            <!-- Package -->

            <div
              v-if="
                course.package
              "
              class="package-area"
            >
              <div class="package-number">
                <strong>
                  {{
                    course.attendedCount
                  }}
                </strong>

                <span>
                  /
                  {{
                    course.totalSessions
                  }}
                  堂
                </span>
              </div>

              <div class="progress-track">
                <div
                  class="progress-value"
                  :style="{
                    width:
                      `${
                        course.totalSessions
                          ? Math.min(
                              course.attendedCount /
                              course.totalSessions *
                              100,
                              100
                            )
                          : 0
                      }%`,
                  }"
                />
              </div>

              <div class="package-meta">
                <span>
                  第
                  {{
                    course.package
                      .cycle_no
                  }}
                  期
                </span>

                <span>
                  剩餘
                  {{
                    course.remainingSessions
                  }}
                  堂
                </span>

                <span>
                  {{
                    course.package
                      .paid
                      ? '已繳費'
                      : '未繳費'
                  }}
                </span>
              </div>

              <NuxtLink
                v-if="
                  course.canRenew
                "
                to="/student"
                class="renew-hint"
              >
                已完成本期堂數，可進行下一期續費
              </NuxtLink>
            </div>

            <div
              v-else
              class="no-package"
            >
              尚未建立堂數方案
            </div>

            <!-- Schedules -->

            <div
              v-if="
                course.schedules
                  .length
              "
              class="schedule-list"
            >
              <div
                v-for="
                  schedule in
                    course.schedules
                "
                :key="
                  schedule.schedule_id
                "
                class="schedule-row"
              >
                <div>
                  <strong>
                    {{
                      getWeekdayLabel(
                        schedule.weekday
                      )
                    }}
                  </strong>

                  <span>
                    {{
                      formatTime(
                        schedule.start_time
                      )
                    }}
                    -
                    {{
                      formatTime(
                        schedule.end_time
                      )
                    }}
                  </span>
                </div>

                <span
                  v-if="
                    schedule.is_primary
                  "
                >
                  主要
                </span>
              </div>
            </div>
          </article>
        </div>

        <div
          v-else
          class="empty-state"
        >
          目前沒有課程。
        </div>
      </section>

      <!-- ====================================================
           Pending Makeup
           ==================================================== -->

      <section
        v-if="
          dashboard
            .pendingMakeups
            .length
        "
        class="section"
      >
        <div class="section-title-row">
          <div class="section-title">
            <span>
              Pending Makeup
            </span>

            <h2>
              待補課
            </h2>
          </div>

          <NuxtLink
            to="/student/makeup"
          >
            安排補課
          </NuxtLink>
        </div>

        <div class="simple-list">
          <article
            v-for="
              item in
                dashboard
                  .pendingMakeups
            "
            :key="
              item.attendance_id
            "
          >
            <div>
              <strong>
                {{
                  item.course_name
                }}
              </strong>

              <span>
                原請假：
                {{
                  formatDate(
                    item.class_date
                  )
                }}

                ・

                {{
                  formatTime(
                    item.start_time
                  )
                }}
              </span>
            </div>

            <span class="pending-badge">
              待補
            </span>
          </article>
        </div>
      </section>

      <!-- ====================================================
           Recent Leave / Makeup
           ==================================================== -->

      <div class="two-section">
        <!-- Leave -->

        <section class="section">
          <div class="section-title-row">
            <div class="section-title">
              <span>
                Leave
              </span>

              <h2>
                最近請假
              </h2>
            </div>

            <NuxtLink
              to="/student/leave"
            >
              全部
            </NuxtLink>
          </div>

          <div
            v-if="
              dashboard
                .recentLeaves
                .length
            "
            class="mini-list"
          >
            <article
              v-for="
                leave in
                  dashboard
                    .recentLeaves
              "
              :key="
                leave.id
              "
            >
              <strong>
                {{
                  leave.course_name
                }}
              </strong>

              <span>
                {{
                  leave.item_count
                }}
                堂・
                {{
                  leave.status ===
                    'ACTIVE'
                    ? '有效'
                    : '已取消'
                }}
              </span>

              <p>
                {{
                  leave.reason ||
                  '未填寫原因'
                }}
              </p>
            </article>
          </div>

          <div
            v-else
            class="empty-state"
          >
            沒有請假紀錄。
          </div>
        </section>

        <!-- Makeup -->

        <section class="section">
          <div class="section-title-row">
            <div class="section-title">
              <span>
                Makeup
              </span>

              <h2>
                最近補課
              </h2>
            </div>

            <NuxtLink
              to="/student/makeup"
            >
              全部
            </NuxtLink>
          </div>

          <div
            v-if="
              dashboard
                .recentMakeups
                .length
            "
            class="mini-list"
          >
            <article
              v-for="
                makeup in
                  dashboard
                    .recentMakeups
              "
              :key="
                makeup.id
              "
            >
              <strong>
                {{
                  makeup.course_name
                }}
              </strong>

              <span>
                {{
                  formatDate(
                    makeup.source_class_date
                  )
                }}
                →
                {{
                  formatDate(
                    makeup.makeup_class_date
                  )
                }}
              </span>

              <p>
                {{
                  makeup.status ===
                    'ACTIVE'
                    ? '有效補課'
                    : '已取消'
                }}
              </p>
            </article>
          </div>

          <div
            v-else
            class="empty-state"
          >
            沒有補課紀錄。
          </div>
        </section>
      </div>

      <!-- ====================================================
           My Timeline
           ==================================================== -->

      <section class="section timeline-section">
        <div class="section-title-row">
          <div class="section-title">
            <span>
              My Timeline
            </span>

            <h2>
              最近操作紀錄
            </h2>
          </div>

          <NuxtLink
            to="/student/audit"
            class="timeline-link"
          >
            查看所有 Log
          </NuxtLink>
        </div>

        <div
          v-if="
            dashboard
              .recentAudit
              .length
          "
          class="timeline-preview"
        >
          <article
            v-for="
              log in
                dashboard
                  .recentAudit
            "
            :key="
              log.id
            "
          >
            <span class="timeline-dot" />

            <div>
              <div class="timeline-heading">
                <strong>
                  {{
                    getActionLabel(
                      log.action
                    )
                  }}
                  ・
                  {{
                    getEntityLabel(
                      log.entity_type
                    )
                  }}
                </strong>

                <span>
                  {{
                    getActorLabel(
                      log.actor_role
                    )
                  }}
                </span>
              </div>

              <p>
                {{
                  log.note ||
                  '資料異動'
                }}
              </p>

              <small>
                {{
                  log.course_name ||
                  ''
                }}

                {{
                  formatDateTime(
                    log.created_at
                  )
                }}
              </small>
            </div>
          </article>
        </div>

        <div
          v-else
          class="empty-state"
        >
          目前沒有操作紀錄。
        </div>

        <NuxtLink
          to="/student/audit"
          class="all-log-button"
        >
          查看我的完整 Timeline
        </NuxtLink>
      </section>
    </div>
  </main>
</template>

<style scoped>
.student-dashboard {
  min-height: 100vh;
  padding:
    20px
    14px
    50px;
  background: #f7f7f7;
  color: #222222;
}

.container {
  width: 100%;
  max-width: 620px;
  margin: 0 auto;
}

/* ============================================================
   Header
   ============================================================ */

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.page-header > div > span,
.section-title > span {
  color: #999999;
  font-size: 9px;
  letter-spacing: 1px;
}

.page-header h1 {
  margin: 4px 0 0;
  font-size: 24px;
}

.page-header p {
  margin: 4px 0 0;
  color: #888888;
  font-size: 9px;
}

.refresh-button {
  min-height: 36px;
  padding: 0 11px;
  border: 0;
  background: #eeeeee;
  border-radius: 9px;
  font-size: 9px;
}

/* ============================================================
   Navigation
   ============================================================ */

.navigation-grid {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 8px;
  margin-top: 17px;
}

.navigation-grid a {
  padding: 13px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 14px;
  color: #222222;
  text-decoration: none;
}

.navigation-grid span {
  display: block;
  color: #999999;
  font-size: 8px;
}

.navigation-grid strong {
  display: block;
  margin-top: 5px;
  font-size: 10px;
}

.navigation-grid .audit-link {
  background: #222222;
  color: #ffffff;
}

.navigation-grid .audit-link span {
  color:
    rgb(
      255
      255
      255
      /
      55%
    );
}

/* ============================================================
   Section
   ============================================================ */

.section {
  margin-top: 19px;
}

.section-title h2 {
  margin: 3px 0 9px;
  font-size: 16px;
}

.section-title-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
}

.section-title-row a {
  margin-bottom: 9px;
  color: #777777;
  font-size: 9px;
  text-decoration: none;
}

/* ============================================================
   Next
   ============================================================ */

.next-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 13px;
  padding: 17px;
  background: #222222;
  border-radius: 17px;
  color: #ffffff;
}

.next-card > div {
  display: flex;
  flex-direction: column;
}

.next-card strong {
  font-size: 12px;
}

.next-card span {
  margin-top: 4px;
  color:
    rgb(
      255
      255
      255
      /
      65%
    );
  font-size: 9px;
}

.next-card small {
  margin-top: 5px;
  color:
    rgb(
      255
      255
      255
      /
      45%
    );
  font-size: 8px;
}

.next-time {
  align-items: flex-end;
}

/* ============================================================
   Course
   ============================================================ */

.course-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.course-card {
  padding: 15px;
  background: #ffffff;
  border-radius: 16px;
}

.course-card > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.course-card header span {
  color: #999999;
  font-size: 8px;
}

.course-card h3 {
  margin: 3px 0 0;
  font-size: 14px;
}

.renew-badge {
  padding: 5px 8px;
  background: #fff3d9;
  border-radius: 999px;
  color: #94701d !important;
}

.package-area {
  margin-top: 12px;
  padding: 12px;
  background: #f7f7f7;
  border-radius: 12px;
}

.package-number {
  display: flex;
  align-items: baseline;
}

.package-number strong {
  font-size: 24px;
}

.package-number span {
  margin-left: 4px;
  color: #888888;
  font-size: 10px;
}

.progress-track {
  height: 6px;
  margin-top: 9px;
  overflow: hidden;
  background: #dddddd;
  border-radius: 999px;
}

.progress-value {
  height: 100%;
  background: #222222;
  border-radius: inherit;
}

.package-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 12px;
  margin-top: 8px;
  color: #888888;
  font-size: 8px;
}

.renew-hint {
  display: block;
  margin-top: 10px;
  padding: 8px;
  background: #222222;
  border-radius: 8px;
  color: #ffffff;
  font-size: 8px;
  text-align: center;
  text-decoration: none;
}

.no-package {
  margin-top: 11px;
  padding: 10px;
  background: #fff5e9;
  border-radius: 10px;
  color: #977044;
  font-size: 9px;
}

.schedule-list {
  margin-top: 10px;
}

.schedule-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 39px;
  border-top: 1px solid #eeeeee;
}

.schedule-row > div {
  display: flex;
  align-items: center;
  gap: 7px;
}

.schedule-row strong {
  font-size: 9px;
}

.schedule-row div span,
.schedule-row > span {
  color: #999999;
  font-size: 8px;
}

/* ============================================================
   Pending
   ============================================================ */

.simple-list,
.mini-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.simple-list article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
  padding: 12px;
  background: #ffffff;
  border-radius: 12px;
}

.simple-list article > div {
  display: flex;
  flex-direction: column;
}

.simple-list strong {
  font-size: 10px;
}

.simple-list span {
  margin-top: 3px;
  color: #888888;
  font-size: 8px;
}

.pending-badge {
  padding: 5px 7px;
  background: #fff3d9;
  border-radius: 999px;
  color: #91701e !important;
}

/* ============================================================
   Two Section
   ============================================================ */

.two-section {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 10px;
}

.mini-list article {
  padding: 12px;
  background: #ffffff;
  border-radius: 12px;
}

.mini-list strong {
  display: block;
  font-size: 10px;
}

.mini-list span {
  display: block;
  margin-top: 4px;
  color: #888888;
  font-size: 8px;
}

.mini-list p {
  margin: 6px 0 0;
  color: #666666;
  font-size: 8px;
}

/* ============================================================
   Timeline
   ============================================================ */

.timeline-section {
  padding-top: 4px;
}

.timeline-link {
  font-weight: 600;
}

.timeline-preview {
  position: relative;
  padding-left: 19px;
}

.timeline-preview::before {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 5px;
  width: 1px;
  background: #dddddd;
  content: '';
}

.timeline-preview article {
  position: relative;
  margin-bottom: 8px;
  padding: 11px;
  background: #ffffff;
  border-radius: 12px;
}

.timeline-dot {
  position: absolute;
  top: 15px;
  left: -18px;
  z-index: 1;
  width: 9px;
  height: 9px;
  background: #ffffff;
  border: 2px solid #777777;
  border-radius: 50%;
}

.timeline-heading {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.timeline-heading strong {
  font-size: 9px;
}

.timeline-heading span {
  color: #999999;
  font-size: 8px;
}

.timeline-preview p {
  margin: 5px 0 0;
  color: #666666;
  font-size: 8px;
}

.timeline-preview small {
  display: block;
  margin-top: 5px;
  color: #aaaaaa;
  font-size: 8px;
}

.all-log-button {
  display: block;
  margin-top: 9px;
  padding: 11px;
  background: #222222;
  border-radius: 11px;
  color: #ffffff;
  font-size: 9px;
  text-align: center;
  text-decoration: none;
}

/* ============================================================
   Common
   ============================================================ */

.empty-state {
  padding: 25px;
  background: #ffffff;
  border-radius: 14px;
  color: #aaaaaa;
  font-size: 9px;
  text-align: center;
}

.error-message {
  margin-top: 11px;
  padding: 10px;
  background: #fff0f0;
  border-radius: 10px;
  color: #c94343;
  font-size: 9px;
}

button:disabled {
  opacity: 0.5;
}

@media (
  max-width: 480px
) {
  .two-section {
    grid-template-columns:
      1fr;
  }
}
</style>
