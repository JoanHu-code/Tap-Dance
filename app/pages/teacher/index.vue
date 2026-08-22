<script setup>
const {
  $liff,
} = useNuxtApp()

const authStore =
  useAuthStore()

const loading =
  ref(true)

const loginLoading =
  ref(false)

const dashboardLoading =
  ref(false)

const errorMessage =
  ref('')

const dashboard =
  ref({
    summary: {
      studentCount: 0,
      courseCount: 0,
      linkedStudentCount: 0,
      unlinkedStudentCount: 0,
      pendingRenewalCount: 0,
    },

    students: [],

    courses: [],

    pendingRenewals: [],

    recentAudits: [],
  })

const teacher =
  computed(() => {
    return (
      authStore.user ||
      null
    )
  })

const summary =
  computed(() => {
    return (
      dashboard.value
        ?.summary || {
        studentCount: 0,
        courseCount: 0,
        linkedStudentCount: 0,
        unlinkedStudentCount: 0,
        pendingRenewalCount: 0,
      }
    )
  })

const students =
  computed(() => {
    return (
      dashboard.value
        ?.students || []
    )
  })

const courses =
  computed(() => {
    return (
      dashboard.value
        ?.courses || []
    )
  })

const pendingRenewals =
  computed(() => {
    return (
      dashboard.value
        ?.pendingRenewals ||
      []
    )
  })

const recentAudits =
  computed(() => {
    return (
      dashboard.value
        ?.recentAudits ||
      []
    )
  })

const getStudentName = (
  student
) => {
  return (
    student?.name ||
    student?.display_name ||
    `學生 #${student?.id}`
  )
}

const getCourseName = (
  course
) => {
  return (
    course?.name ||
    course?.course_name ||
    `課程 #${course?.id}`
  )
}

const formatDateTime = (
  value
) => {
  if (!value) {
    return '-'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value)
  }

  return new Intl
    .DateTimeFormat(
      'zh-TW',
      {
        timeZone:
          'Asia/Taipei',

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit',

        hour:
          '2-digit',

        minute:
          '2-digit',

        hour12:
          false,
      }
    )
    .format(date)
}

const formatMoney = (
  value
) => {
  return new Intl
    .NumberFormat(
      'zh-TW'
    )
    .format(
      Number(
        value || 0
      )
    )
}

const fetchDashboard =
  async () => {
    dashboardLoading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/teacher/dashboard'
        )

      dashboard.value = {
        summary:
          response?.summary || {
            studentCount: 0,
            courseCount: 0,
            linkedStudentCount: 0,
            unlinkedStudentCount: 0,
            pendingRenewalCount: 0,
          },

        students:
          response?.students ||
          [],

        courses:
          response?.courses ||
          [],

        pendingRenewals:
          response
            ?.pendingRenewals ||
          [],

        recentAudits:
          response
            ?.recentAudits ||
          [],
      }
    } catch (error) {
      console.error(
        '載入老師 Dashboard 失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        'Dashboard 載入失敗'
    } finally {
      dashboardLoading.value =
        false
    }
  }

const loginTeacher =
  async () => {
    if (
      loginLoading.value
    ) {
      return
    }

    loginLoading.value =
      true

    errorMessage.value =
      ''

    try {
      await $liff.initialize(
        'TEACHER'
      )

      if (
        !$liff.isLoggedIn()
      ) {
        await $liff.login(
          'TEACHER'
        )

        return
      }

      const idToken =
        await $liff
          .getIdToken(
            'TEACHER'
          )

      if (!idToken) {
        throw new Error(
          '無法取得 LINE ID Token'
        )
      }

      const response =
        await $fetch(
          '/api/auth/teacher/line',
          {
            method:
              'POST',

            body: {
              idToken,
            },
          }
        )

      authStore
        .setTeacherLogin(
          response
        )

      await fetchDashboard()
    } catch (error) {
      console.error(
        '老師登入失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '老師端登入失敗'
    } finally {
      loginLoading.value =
        false

      loading.value =
        false
    }
  }

const initializePage =
  async () => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      /**
       * Pinia 已經有老師資訊時，
       * 先用既有 Session。
       */
      if (
        authStore
          .isTeacher
      ) {
        await fetchDashboard()

        return
      }

      /**
       * 先檢查 HttpOnly Session。
       */
      const result =
        await authStore
          .fetchTeacherMe({
            force: true,
          })

      if (
        result?.success &&
        authStore
          .isTeacher
      ) {
        await fetchDashboard()

        return
      }

      /**
       * Session 沒有，
       * 才走 LIFF Login。
       */
      await loginTeacher()
    } catch (error) {
      console.error(
        '老師首頁初始化失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '老師端初始化失敗'
    } finally {
      loading.value =
        false
    }
  }

const retry =
  async () => {
    await initializePage()
  }

onMounted(
  async () => {
    await initializePage()
  }
)
</script>

<template>
  <main class="teacher-dashboard">
    <div
      v-if="
        loading ||
        dashboardLoading
      "
      class="state-page"
    >
      <div class="state-card">
        <div class="loader" />

        <h2>
          正在載入管理中心
        </h2>

        <p>
          正在確認老師身分與取得最新課程資料。
        </p>
      </div>
    </div>

    <div
      v-else-if="
        errorMessage
      "
      class="state-page"
    >
      <div class="state-card">
        <div
          class="
            state-icon
            state-icon--error
          "
        >
          !
        </div>

        <h2>
          無法載入老師端
        </h2>

        <p>
          {{
            errorMessage
          }}
        </p>

        <button
          type="button"
          class="
            primary-button
          "
          @click="
            retry
          "
        >
          重新嘗試
        </button>
      </div>
    </div>

    <div
      v-else
      class="
        dashboard-container
      "
    >
      <header
        class="
          dashboard-header
        "
      >
        <div>
          <span
            class="eyebrow"
          >
            Tap Dance
          </span>

          <h1>
            老師管理中心
          </h1>

          <p>
            學生、課程與教學狀況總覽
          </p>
        </div>

        <div
          class="
            teacher-profile
          "
        >
          <div
            class="
              teacher-profile__text
            "
          >
            <strong>
              {{
                teacher
                  ?.display_name ||
                '老師'
              }}
            </strong>

            <span>
              Teacher
            </span>
          </div>

          <div
            class="
              teacher-avatar
            "
          >
            <img
              v-if="
                teacher
                  ?.picture_url
              "
              :src="
                teacher
                  .picture_url
              "
              alt="老師頭像"
            >

            <span v-else>
              師
            </span>
          </div>
        </div>
      </header>

      <section
        class="
          summary-grid
        "
      >
        <article
          class="
            summary-card
          "
        >
          <span
            class="
              summary-card__label
            "
          >
            學生總數
          </span>

          <strong
            class="
              summary-card__number
            "
          >
            {{
              summary
                .studentCount
            }}
          </strong>

          <span
            class="
              summary-card__hint
            "
          >
            系統中的學生
          </span>
        </article>

        <article
          class="
            summary-card
          "
        >
          <span
            class="
              summary-card__label
            "
          >
            LINE 已綁定
          </span>

          <strong
            class="
              summary-card__number
            "
          >
            {{
              summary
                .linkedStudentCount
            }}
          </strong>

          <span
            class="
              summary-card__hint
            "
          >
            可以使用學生端
          </span>
        </article>

        <article
          class="
            summary-card
          "
        >
          <span
            class="
              summary-card__label
            "
          >
            待續期
          </span>

          <strong
            class="
              summary-card__number
            "
          >
            {{
              summary
                .pendingRenewalCount
            }}
          </strong>

          <span
            class="
              summary-card__hint
            "
          >
            本期堂數已完成
          </span>
        </article>

        <article
          class="
            summary-card
          "
        >
          <span
            class="
              summary-card__label
            "
          >
            課程數量
          </span>

          <strong
            class="
              summary-card__number
            "
          >
            {{
              summary
                .courseCount
            }}
          </strong>

          <span
            class="
              summary-card__hint
            "
          >
            已建立的課程
          </span>
        </article>
      </section>

      <section
        class="
          navigation-grid
        "
      >
        <NuxtLink
          to="
            /teacher/students
          "
          class="
            navigation-card
          "
        >
          <div
            class="
              navigation-card__icon
            "
          >
            人
          </div>

          <div>
            <strong>
              學生管理
            </strong>

            <span>
              基本資料、課程與方案
            </span>
          </div>

          <span
            class="arrow"
          >
            ›
          </span>
        </NuxtLink>

        <NuxtLink
          to="
            /teacher/courses
          "
          class="
            navigation-card
          "
        >
          <div
            class="
              navigation-card__icon
            "
          >
            課
          </div>

          <div>
            <strong>
              課程管理
            </strong>

            <span>
              課程與固定時段
            </span>
          </div>

          <span
            class="arrow"
          >
            ›
          </span>
        </NuxtLink>

        <NuxtLink
          to="
            /teacher/schedule
          "
          class="
            navigation-card
          "
        >
          <div
            class="
              navigation-card__icon
            "
          >
            日
          </div>

          <div>
            <strong>
              課表與點名
            </strong>

            <span>
              出席、請假與補課
            </span>
          </div>

          <span
            class="arrow"
          >
            ›
          </span>
        </NuxtLink>

        <NuxtLink
          to="
            /teacher/audit
          "
          class="
            navigation-card
          "
        >
          <div
            class="
              navigation-card__icon
            "
          >
            紀
          </div>

          <div>
            <strong>
              操作紀錄
            </strong>

            <span>
              查看所有資料異動
            </span>
          </div>

          <span
            class="arrow"
          >
            ›
          </span>
        </NuxtLink>
      </section>

      <section
        class="
          dashboard-grid
        "
      >
        <article
          class="panel"
        >
          <div
            class="
              panel__header
            "
          >
            <div>
              <span
                class="
                  panel__eyebrow
                "
              >
                Students
              </span>

              <h2>
                學生列表
              </h2>
            </div>

            <NuxtLink
              to="
                /teacher/students
              "
              class="
                panel__link
              "
            >
              查看全部
            </NuxtLink>
          </div>

          <div
            v-if="
              students.length
            "
            class="
              item-list
            "
          >
            <NuxtLink
              v-for="
                student in
                students.slice(
                  0,
                  6
                )
              "
              :key="
                student.id
              "
              :to="
                `/teacher/students/${student.id}`
              "
              class="
                list-item
              "
            >
              <div
                class="
                  student-avatar
                "
              >
                {{
                  getStudentName(
                    student
                  )
                    .slice(
                      0,
                      1
                    )
                }}
              </div>

              <div
                class="
                  list-item__content
                "
              >
                <strong>
                  {{
                    getStudentName(
                      student
                    )
                  }}
                </strong>

                <span>
                  {{
                    student.phone ||
                    '未設定電話'
                  }}
                </span>
              </div>

              <div
                class="
                  status-badge
                "
                :class="{
                  'status-badge--active':
                    student.user_id,
                }"
              >
                {{
                  student.user_id
                    ? 'LINE 已綁定'
                    : '未綁定'
                }}
              </div>

              <span
                class="arrow"
              >
                ›
              </span>
            </NuxtLink>
          </div>

          <div
            v-else
            class="
              empty-state
            "
          >
            尚未建立學生
          </div>
        </article>

        <article
          class="panel"
        >
          <div
            class="
              panel__header
            "
          >
            <div>
              <span
                class="
                  panel__eyebrow
                "
              >
                Courses
              </span>

              <h2>
                課程列表
              </h2>
            </div>

            <NuxtLink
              to="
                /teacher/courses
              "
              class="
                panel__link
              "
            >
              課程管理
            </NuxtLink>
          </div>

          <div
            v-if="
              courses.length
            "
            class="
              item-list
            "
          >
            <NuxtLink
              v-for="
                course in
                courses.slice(
                  0,
                  6
                )
              "
              :key="
                course.id
              "
              to="
                /teacher/courses
              "
              class="
                list-item
              "
            >
              <div
                class="
                  course-icon
                "
              >
                ♪
              </div>

              <div
                class="
                  list-item__content
                "
              >
                <strong>
                  {{
                    getCourseName(
                      course
                    )
                  }}
                </strong>

                <span>
                  {{
                    course.description ||
                    '查看課程與班別設定'
                  }}
                </span>
              </div>

              <span
                class="arrow"
              >
                ›
              </span>
            </NuxtLink>
          </div>

          <div
            v-else
            class="
              empty-state
            "
          >
            尚未建立課程
          </div>
        </article>
      </section>

      <section
        v-if="
          pendingRenewals.length
        "
        class="
          panel
          renewal-panel
        "
      >
        <div
          class="
            panel__header
          "
        >
          <div>
            <span
              class="
                panel__eyebrow
              "
            >
              Renewal
            </span>

            <h2>
              待續期學生
            </h2>
          </div>
        </div>

        <div
          class="
            renewal-list
          "
        >
          <NuxtLink
            v-for="
              item in
                pendingRenewals
            "
            :key="
              item.id
            "
            :to="
              `/teacher/students/${item.student_id}`
            "
            class="
              renewal-item
            "
          >
            <div>
              <strong>
                {{
                  item.student_name
                }}
              </strong>

              <span>
                {{
                  item.course_name ||
                  '課程'
                }}
                ·
                第
                {{
                  item.cycle_no ||
                  1
                }}
                期
              </span>
            </div>

            <div
              class="
                renewal-item__right
              "
            >
              <span>
                {{
                  item.total_sessions
                }}
                堂
              </span>

              <strong>
                NT$
                {{
                  formatMoney(
                    item.price
                  )
                }}
              </strong>
            </div>
          </NuxtLink>
        </div>
      </section>

      <section
        class="
          panel
          audit-panel
        "
      >
        <div
          class="
            panel__header
          "
        >
          <div>
            <span
              class="
                panel__eyebrow
              "
            >
              Recent Activity
            </span>

            <h2>
              最近異動
            </h2>
          </div>

          <NuxtLink
            to="
              /teacher/audit
            "
            class="
              panel__link
            "
          >
            查看紀錄
          </NuxtLink>
        </div>

        <div
          v-if="
            recentAudits.length
          "
          class="
            audit-list
          "
        >
          <div
            v-for="
              audit in
                recentAudits
            "
            :key="
              audit.id
            "
            class="
              audit-item
            "
          >
            <div>
              <strong>
                {{
                  audit.student_name ||
                  audit.entity_type
                }}
              </strong>

              <span>
                {{
                  audit.action
                }}
                ·
                {{
                  audit.entity_type
                }}
              </span>
            </div>

            <time>
              {{
                formatDateTime(
                  audit.created_at
                )
              }}
            </time>
          </div>
        </div>

        <div
          v-else
          class="
            empty-state
          "
        >
          尚未有操作紀錄
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.teacher-dashboard {
  min-height: 100vh;
  padding: 28px 20px 60px;
  background: #f6f6f6;
  color: #222222;
}

.dashboard-container {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
  padding: 4px;
}

.eyebrow,
.panel__eyebrow {
  color: #999999;
  font-size: 12px;
  letter-spacing: 1.2px;
}

.dashboard-header h1 {
  margin: 4px 0 0;
  font-size: 28px;
}

.dashboard-header p {
  margin: 7px 0 0;
  color: #888888;
  font-size: 13px;
}

.teacher-profile {
  display: flex;
  align-items: center;
  gap: 11px;
}

.teacher-profile__text {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.teacher-profile__text strong {
  font-size: 14px;
}

.teacher-profile__text span {
  margin-top: 2px;
  color: #999999;
  font-size: 11px;
}

.teacher-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  background: #222222;
  border-radius: 50%;
  color: #ffffff;
  font-weight: 700;
}

.teacher-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.summary-grid {
  display: grid;
  grid-template-columns:
    repeat(
      4,
      minmax(0, 1fr)
    );
  gap: 14px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  min-height: 140px;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 22px;
  box-shadow:
    0 8px 24px
    rgb(0 0 0 / 4%);
}

.summary-card__label {
  color: #777777;
  font-size: 13px;
}

.summary-card__number {
  margin-top: 12px;
  font-size: 31px;
}

.summary-card__hint {
  margin-top: auto;
  color: #aaaaaa;
  font-size: 11px;
}

.navigation-grid {
  display: grid;
  grid-template-columns:
    repeat(
      4,
      minmax(0, 1fr)
    );
  gap: 14px;
  margin-top: 18px;
}

.navigation-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 20px;
  color: inherit;
  text-decoration: none;
}

.navigation-card__icon {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #222222;
  border-radius: 13px;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
}

.navigation-card > div:nth-child(2) {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.navigation-card strong {
  font-size: 13px;
}

.navigation-card span:not(
  .navigation-card__icon
):not(
  .arrow
) {
  margin-top: 4px;
  overflow: hidden;
  color: #999999;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-grid {
  display: grid;
  grid-template-columns:
    repeat(
      2,
      minmax(0, 1fr)
    );
  gap: 18px;
  margin-top: 18px;
}

.panel {
  padding: 22px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 24px;
  box-shadow:
    0 8px 24px
    rgb(0 0 0 / 4%);
}

.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 17px;
}

.panel__header h2 {
  margin: 4px 0 0;
  font-size: 18px;
}

.panel__link {
  flex: 0 0 auto;
  color: #555555;
  font-size: 12px;
  text-decoration: none;
}

.item-list {
  display: flex;
  flex-direction: column;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 66px;
  padding: 9px 3px;
  border-bottom: 1px solid #f0f0f0;
  color: inherit;
  text-decoration: none;
}

.list-item:last-child {
  border-bottom: 0;
}

.student-avatar,
.course-icon {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  background: #f2f2f2;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 700;
}

.list-item__content {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.list-item__content strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-item__content span {
  overflow: hidden;
  margin-top: 4px;
  color: #999999;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  flex: 0 0 auto;
  padding: 5px 8px;
  background: #f3f3f3;
  border-radius: 999px;
  color: #999999;
  font-size: 10px;
}

.status-badge--active {
  background: #eef8ee;
  color: #4b9450;
}

.arrow {
  flex: 0 0 auto;
  color: #bbbbbb;
  font-size: 21px;
}

.renewal-panel,
.audit-panel {
  margin-top: 18px;
}

.renewal-list,
.audit-list {
  display: flex;
  flex-direction: column;
}

.renewal-item,
.audit-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 64px;
  padding: 10px 2px;
  border-bottom: 1px solid #f0f0f0;
}

.renewal-item {
  color: inherit;
  text-decoration: none;
}

.renewal-item:last-child,
.audit-item:last-child {
  border-bottom: 0;
}

.renewal-item > div:first-child,
.audit-item > div:first-child {
  display: flex;
  flex-direction: column;
}

.renewal-item strong,
.audit-item strong {
  font-size: 13px;
}

.renewal-item span,
.audit-item span {
  margin-top: 4px;
  color: #999999;
  font-size: 11px;
}

.renewal-item__right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.audit-item time {
  flex: 0 0 auto;
  color: #999999;
  font-size: 11px;
}

.empty-state {
  padding: 35px 10px;
  color: #aaaaaa;
  font-size: 13px;
  text-align: center;
}

.state-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height:
    calc(
      100vh - 88px
    );
}

.state-card {
  width: 100%;
  max-width: 380px;
  padding: 34px 26px;
  background: #ffffff;
  border-radius: 26px;
  box-shadow:
    0 18px 60px
    rgb(0 0 0 / 8%);
  text-align: center;
}

.state-card h2 {
  margin: 18px 0 0;
  font-size: 20px;
}

.state-card p {
  margin: 10px 0 0;
  color: #777777;
  font-size: 13px;
  line-height: 1.7;
}

.loader {
  width: 42px;
  height: 42px;
  margin: 0 auto;
  border: 4px solid #eeeeee;
  border-top-color: #222222;
  border-radius: 50%;
  animation:
    loading 0.75s
    linear infinite;
}

.state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin: 0 auto;
  border-radius: 50%;
  font-size: 22px;
  font-weight: 700;
}

.state-icon--error {
  background: #fff0f0;
  color: #d94a4a;
}

.primary-button {
  width: 100%;
  min-height: 46px;
  margin-top: 22px;
  border: 0;
  background: #222222;
  border-radius: 14px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

@keyframes loading {
  to {
    transform:
      rotate(360deg);
  }
}

@media (
  max-width: 900px
) {
  .summary-grid {
    grid-template-columns:
      repeat(
        2,
        minmax(0, 1fr)
      );
  }

  .navigation-grid {
    grid-template-columns:
      repeat(
        2,
        minmax(0, 1fr)
      );
  }

  .dashboard-grid {
    grid-template-columns:
      1fr;
  }
}

@media (
  max-width: 560px
) {
  .teacher-dashboard {
    padding:
      18px
      14px
      42px;
  }

  .dashboard-header {
    align-items:
      flex-start;
  }

  .dashboard-header h1 {
    font-size: 24px;
  }

  .teacher-profile__text {
    display: none;
  }

  .summary-card {
    min-height: 125px;
    padding: 17px;
  }

  .summary-card__number {
    font-size: 27px;
  }

  .navigation-grid {
    grid-template-columns:
      1fr;
  }

  .panel {
    padding: 18px;
  }

  .status-badge {
    display: none;
  }

  .audit-item {
    align-items:
      flex-start;
  }

  .audit-item time {
    max-width: 100px;
    text-align: right;
  }
}
</style>