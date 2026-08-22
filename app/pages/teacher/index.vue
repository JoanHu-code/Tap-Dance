<script setup>
definePageMeta({
  middleware:
    'teacher-auth',
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
    todaySummary: {
      sessions: 0,
      attended: 0,
      leave: 0,
      absent: 0,
    },
    todaySessions: [],
    nextSession: null,
    renewRequired: [],
    pendingMakeups: [],
    recentLeaves: [],
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
// Date Time
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
          '/api/teacher/dashboard'
        )

      dashboard.value =
        response.dashboard ||
        dashboard.value
    } catch (error) {
      console.error(
        'Teacher Dashboard 載入失敗：',
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
// LINE App 的登入狀態和本系統的 Session 是兩件事。
// 入口頁負責把 LIFF ID Token 交給後端，建立 httpOnly Session Cookie。
// ============================================================

const authenticate =
  async () => {
    const existingSession =
      await authStore
        .fetchTeacherMe({
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
          'TEACHER'
        )

    // liff.login() 會導向 LINE 登入頁；導回本頁後才會繼續。
    if (!loggedIn) {
      return false
    }

    const idToken =
      await $liff
        .getIdToken(
          'TEACHER'
        )

    if (!idToken) {
      throw new Error(
        '無法取得 LINE 登入憑證，請重新開啟老師入口。'
      )
    }

    await $fetch(
      '/api/auth/teacher/line',
      {
        method: 'POST',

        body: {
          idToken,
        },
      }
    )

    const session =
      await authStore
        .fetchTeacherMe({
          force: true,
        })

    if (
      !session?.success
    ) {
      throw new Error(
        '登入 Session 建立失敗，請重新開啟老師入口。'
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
        'Teacher LIFF 登入失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        'LINE 登入失敗，請重新開啟老師入口。'

      loading.value =
        false
    }
  }
)
</script>

<template>
  <main class="teacher-dashboard">
    <div class="container">
      <!-- ====================================================
           Header
           ==================================================== -->

      <header class="page-header">
        <div>
          <span>
            Teacher Dashboard
          </span>

          <h1>
            今日工作台
          </h1>

          <p>
            {{
              dashboard.today ||
              ''
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
              ? '更新中...'
              : '重新整理'
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
           Main Navigation
           ==================================================== -->

      <section class="navigation-grid">
        <NuxtLink
          to="/teacher/attendance"
        >
          <span>
            Attendance
          </span>

          <strong>
            出席管理
          </strong>
        </NuxtLink>

        <NuxtLink
          to="/teacher/leave"
        >
          <span>
            Leave
          </span>

          <strong>
            請假管理
          </strong>
        </NuxtLink>

        <NuxtLink
          to="/teacher/makeup"
        >
          <span>
            Makeup
          </span>

          <strong>
            補課管理
          </strong>
        </NuxtLink>

        <NuxtLink
          to="/teacher/audit"
        >
          <span>
            Audit
          </span>

          <strong>
            操作紀錄
          </strong>
        </NuxtLink>

        <NuxtLink
          to="/teacher/sessions"
        >
          <span>
            Sessions
          </span>

          <strong>
            課堂管理
          </strong>
        </NuxtLink>

        <NuxtLink
          to="/teacher/students"
        >
          <span>
            Students
          </span>

          <strong>
            學生管理
          </strong>
        </NuxtLink>
      </section>

      <!-- ====================================================
           Today Summary
           ==================================================== -->

      <section class="summary-grid">
        <article>
          <span>
            今日課堂
          </span>

          <strong>
            {{
              dashboard
                .todaySummary
                .sessions
            }}
          </strong>
        </article>

        <article>
          <span>
            已上課
          </span>

          <strong>
            {{
              dashboard
                .todaySummary
                .attended
            }}
          </strong>
        </article>

        <article>
          <span>
            請假
          </span>

          <strong>
            {{
              dashboard
                .todaySummary
                .leave
            }}
          </strong>
        </article>

        <article>
          <span>
            缺席
          </span>

          <strong>
            {{
              dashboard
                .todaySummary
                .absent
            }}
          </strong>
        </article>

        <article>
          <span>
            待補課
          </span>

          <strong>
            {{
              dashboard
                .pendingMakeups
                .length
            }}
          </strong>
        </article>

        <article>
          <span>
            待續期
          </span>

          <strong>
            {{
              dashboard
                .renewRequired
                .length
            }}
          </strong>
        </article>
      </section>

      <!-- ====================================================
           Next Session
           ==================================================== -->

      <section class="section">
        <div class="section-title">
          <div>
            <span>
              Next
            </span>

            <h2>
              下一堂課
            </h2>
          </div>
        </div>

        <article
          v-if="
            dashboard.nextSession
          "
          class="next-session-card"
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
          </div>

          <div class="session-time">
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
          目前沒有下一堂已排定課程。
        </div>
      </section>

      <!-- ====================================================
           Today Sessions
           ==================================================== -->

      <section class="section">
        <div class="section-title">
          <div>
            <span>
              Today
            </span>

            <h2>
              今日課堂
            </h2>
          </div>

          <NuxtLink
            to="/teacher/sessions"
          >
            查看全部
          </NuxtLink>
        </div>

        <div
          v-if="
            dashboard.todaySessions
              .length
          "
          class="session-list"
        >
          <article
            v-for="
              session in
                dashboard.todaySessions
            "
            :key="
              session.id
            "
            class="session-card"
          >
            <div>
              <strong>
                {{
                  session.course_name
                }}
              </strong>

              <span>
                {{
                  session.schedule_name
                }}
              </span>
            </div>

            <div class="session-meta">
              <span>
                {{
                  formatTime(
                    session.start_time
                  )
                }}
                -
                {{
                  formatTime(
                    session.end_time
                  )
                }}
              </span>

              <span>
                上課
                {{
                  session.attended_count
                }}
                ・請假
                {{
                  session.leave_count
                }}
                ・缺席
                {{
                  session.absent_count
                }}
              </span>
            </div>
          </article>
        </div>

        <div
          v-else
          class="empty-state"
        >
          今天沒有課堂。
        </div>
      </section>

      <!-- ====================================================
           Two Columns
           ==================================================== -->

      <div class="two-column">
        <!-- Renew -->

        <section class="section">
          <div class="section-title">
            <div>
              <span>
                Renew
              </span>

              <h2>
                待續期
              </h2>
            </div>
          </div>

          <div
            v-if="
              dashboard
                .renewRequired
                .length
            "
            class="simple-list"
          >
            <NuxtLink
              v-for="
                item in
                  dashboard
                    .renewRequired
              "
              :key="
                item.id
              "
              :to="
                `/teacher/students/${item.student_id}`
              "
              class="simple-item"
            >
              <div>
                <strong>
                  {{
                    item.student_name
                  }}
                </strong>

                <span>
                  {{
                    item.course_name
                  }}
                  ・第
                  {{
                    item.cycle_no
                  }}
                  期
                </span>
              </div>

              <b>
                {{
                  item.attended_count
                }}
                /
                {{
                  item.total_sessions
                }}
              </b>
            </NuxtLink>
          </div>

          <div
            v-else
            class="empty-state"
          >
            目前沒有待續期學生。
          </div>
        </section>

        <!-- Makeup -->

        <section class="section">
          <div class="section-title">
            <div>
              <span>
                Makeup
              </span>

              <h2>
                待補課
              </h2>
            </div>

            <NuxtLink
              to="/teacher/makeup"
            >
              前往管理
            </NuxtLink>
          </div>

          <div
            v-if="
              dashboard
                .pendingMakeups
                .length
            "
            class="simple-list"
          >
            <article
              v-for="
                item in
                  dashboard
                    .pendingMakeups
                    .slice(
                      0,
                      6
                    )
              "
              :key="
                item.attendance_id
              "
              class="simple-item"
            >
              <div>
                <strong>
                  {{
                    item.student_name
                  }}
                </strong>

                <span>
                  {{
                    item.course_name
                  }}
                  ・
                  {{
                    formatDate(
                      item.class_date
                    )
                  }}
                </span>
              </div>

              <b>
                待補
              </b>
            </article>
          </div>

          <div
            v-else
            class="empty-state"
          >
            目前沒有待補課。
          </div>
        </section>
      </div>

      <!-- ====================================================
           Recent Leave
           ==================================================== -->

      <section class="section">
        <div class="section-title">
          <div>
            <span>
              Leave
            </span>

            <h2>
              最近請假
            </h2>
          </div>

          <NuxtLink
            to="/teacher/leave"
          >
            查看全部
          </NuxtLink>
        </div>

        <div
          v-if="
            dashboard
              .recentLeaves
              .length
          "
          class="recent-grid"
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
                leave.student_name
              }}
            </strong>

            <span>
              {{
                leave.course_name
              }}
            </span>

            <p>
              {{
                leave.reason ||
                '未填寫原因'
              }}
            </p>

            <small>
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
            </small>
          </article>
        </div>
      </section>

      <!-- ====================================================
           Audit
           ==================================================== -->

      <section class="section">
        <div class="section-title">
          <div>
            <span>
              Audit
            </span>

            <h2>
              最新操作紀錄
            </h2>
          </div>

          <NuxtLink
            to="/teacher/audit"
          >
            完整紀錄
          </NuxtLink>
        </div>

        <div
          v-if="
            dashboard
              .recentAudit
              .length
          "
          class="audit-preview"
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
            <span>
              {{
                getActionLabel(
                  log.action
                )
              }}
              ・
              {{
                log.entity_type
              }}
            </span>

            <strong>
              {{
                log.student_name ||
                log.note ||
                '-'
              }}
            </strong>

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
          </article>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.teacher-dashboard {
  min-height: 100vh;
  padding:
    28px
    20px
    60px;
  background: #f6f6f6;
  color: #222222;
}

.container {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
}

.page-header > div > span,
.section-title span {
  color: #999999;
  font-size: 9px;
  letter-spacing: 1px;
}

.page-header h1 {
  margin: 4px 0 0;
}

.page-header p {
  margin: 5px 0 0;
  color: #888888;
  font-size: 11px;
}

.refresh-button {
  min-height: 38px;
  padding: 0 13px;
  border: 0;
  background: #eeeeee;
  border-radius: 10px;
}

.navigation-grid {
  display: grid;
  grid-template-columns:
    repeat(
      6,
      1fr
    );
  gap: 8px;
  margin-top: 20px;
}

.navigation-grid a {
  min-width: 0;
  padding: 13px;
  background: #222222;
  border-radius: 14px;
  color: #ffffff;
  text-decoration: none;
}

.navigation-grid span {
  display: block;
  color:
    rgb(
      255
      255
      255
      /
      55%
    );
  font-size: 8px;
}

.navigation-grid strong {
  display: block;
  margin-top: 5px;
  font-size: 10px;
}

.summary-grid {
  display: grid;
  grid-template-columns:
    repeat(
      6,
      1fr
    );
  gap: 8px;
  margin-top: 12px;
}

.summary-grid article {
  padding: 13px;
  background: #ffffff;
  border-radius: 14px;
}

.summary-grid span {
  color: #999999;
  font-size: 8px;
}

.summary-grid strong {
  display: block;
  margin-top: 5px;
  font-size: 19px;
}

.section {
  margin-top: 18px;
}

.section-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 9px;
}

.section-title h2 {
  margin: 3px 0 0;
  font-size: 16px;
}

.section-title a {
  color: #777777;
  font-size: 9px;
  text-decoration: none;
}

.next-session-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 18px;
  background: #222222;
  border-radius: 18px;
  color: #ffffff;
}

.next-session-card > div {
  display: flex;
  flex-direction: column;
}

.next-session-card span {
  margin-top: 4px;
  color:
    rgb(
      255
      255
      255
      /
      60%
    );
  font-size: 9px;
}

.session-time {
  align-items: flex-end;
}

.session-list,
.simple-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.session-card,
.simple-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
  background: #ffffff;
  border-radius: 13px;
  text-decoration: none;
  color: #222222;
}

.session-card > div,
.simple-item > div {
  display: flex;
  flex-direction: column;
}

.session-card strong,
.simple-item strong {
  font-size: 10px;
}

.session-card span,
.simple-item span {
  margin-top: 3px;
  color: #888888;
  font-size: 8px;
}

.session-meta {
  align-items: flex-end;
}

.simple-item b {
  font-size: 10px;
}

.two-column {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 13px;
}

.recent-grid {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 8px;
}

.recent-grid article {
  padding: 13px;
  background: #ffffff;
  border-radius: 13px;
}

.recent-grid strong {
  display: block;
  font-size: 10px;
}

.recent-grid span {
  display: block;
  margin-top: 3px;
  color: #777777;
  font-size: 9px;
}

.recent-grid p {
  margin: 8px 0 0;
  font-size: 9px;
}

.recent-grid small {
  display: block;
  margin-top: 8px;
  color: #aaaaaa;
  font-size: 8px;
}

.audit-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.audit-preview article {
  display: grid;
  grid-template-columns:
    120px
    1fr
    auto;
  gap: 10px;
  padding: 11px;
  background: #ffffff;
  border-radius: 11px;
}

.audit-preview span,
.audit-preview small {
  color: #999999;
  font-size: 8px;
}

.audit-preview strong {
  font-size: 9px;
}

.empty-state {
  padding: 25px;
  background: #ffffff;
  border-radius: 14px;
  color: #aaaaaa;
  font-size: 9px;
  text-align: center;
}

.error-message {
  margin-top: 12px;
  padding: 10px;
  background: #fff0f0;
  border-radius: 10px;
  color: #c94343;
  font-size: 9px;
}

@media (
  max-width: 900px
) {
  .navigation-grid,
  .summary-grid {
    grid-template-columns:
      repeat(
        3,
        1fr
      );
  }
}

@media (
  max-width: 700px
) {
  .two-column {
    grid-template-columns:
      1fr;
  }

  .recent-grid {
    grid-template-columns:
      1fr;
  }

  .audit-preview article {
    grid-template-columns:
      1fr;
  }
}

@media (
  max-width: 480px
) {
  .teacher-dashboard {
    padding:
      18px
      13px
      45px;
  }

  .navigation-grid,
  .summary-grid {
    grid-template-columns:
      1fr
      1fr;
  }
}
</style>
