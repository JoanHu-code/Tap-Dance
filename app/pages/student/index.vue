<script setup>
const {
  $liff,
} = useNuxtApp()

const loading = ref(true)

const loginLoading = ref(false)

const errorMessage = ref('')

const user = ref(null)

const student = ref(null)

const enrollments = ref([])

const packages = ref([])

const attendanceRecords = ref([])

const bankAccount = ref(null)

const linked = ref(false)

const activePackage = computed(() => {
  return (
    packages.value.find(
      (item) =>
        item.status === 'ACTIVE'
    ) ||
    packages.value[0] ||
    null
  )
})

const currentEnrollment = computed(() => {
  return (
    enrollments.value.find(
      (item) =>
        !item.status ||
        item.status === 'ACTIVE'
    ) ||
    enrollments.value[0] ||
    null
  )
})

const totalSessions = computed(() => {
  return Number(
    activePackage.value
      ?.total_sessions ||
    activePackage.value
      ?.totalSessions ||
    0
  )
})

const usedSessions = computed(() => {
  return Number(
    activePackage.value
      ?.used_sessions ??
    activePackage.value
      ?.attended_count ??
    0
  )
})

const remainingSessions =
  computed(() => {
    return Math.max(
      totalSessions.value -
        usedSessions.value,
      0
    )
  })

const progressPercentage =
  computed(() => {
    if (
      totalSessions.value <= 0
    ) {
      return 0
    }

    return Math.min(
      Math.round(
        (
          usedSessions.value /
          totalSessions.value
        ) * 100
      ),
      100
    )
  })

const courseName = computed(() => {
  return (
    currentEnrollment.value
      ?.course_name ||
    currentEnrollment.value
      ?.name ||
    '尚未設定課程'
  )
})

const scheduleText = computed(() => {
  const weekday =
    currentEnrollment.value
      ?.schedule_weekday

  const startTime =
    currentEnrollment.value
      ?.schedule_start_time

  if (
    weekday === undefined ||
    weekday === null
  ) {
    return '尚未設定固定班別'
  }

  const weekdayMap = {
    0: '星期日',
    1: '星期一',
    2: '星期二',
    3: '星期三',
    4: '星期四',
    5: '星期五',
    6: '星期六',
  }

  const label =
    weekdayMap[
      Number(weekday)
    ] ||
    String(weekday)

  if (!startTime) {
    return label
  }

  return `${label} ${String(
    startTime
  ).slice(0, 5)}`
})

const formatMoney = (
  value
) => {
  const number =
    Number(value || 0)

  return new Intl
    .NumberFormat(
      'zh-TW'
    )
    .format(number)
}

const formatDate = (
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
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }
    )
    .format(date)
}

const getAttendanceLabel = (
  record
) => {
  const status =
    record.status

  switch (status) {
    case 'ATTENDED':
      return '已上課'

    case 'LEAVE':
      return '請假'

    case 'ABSENT':
      return '缺席'

    case 'CANCELLED':
      return '已取消'

    default:
      return status || '紀錄'
  }
}

const loginStudent = async () => {
  if (loginLoading.value) {
    return
  }

  loginLoading.value = true
  errorMessage.value = ''

  try {
    await $liff.initialize(
      'STUDENT'
    )

    if (
      !$liff.isLoggedIn()
    ) {
      await $liff.login(
        'STUDENT'
      )

      return
    }

    const idToken =
      await $liff.getIdToken(
        'STUDENT'
      )

    if (!idToken) {
      throw new Error(
        '無法取得 LINE ID Token'
      )
    }

    const response =
      await $fetch(
        '/api/auth/student/line',
        {
          method: 'POST',

          body: {
            idToken,
          },
        }
      )

    user.value =
      response.user || null
    
    const authStore =
        useAuthStore()

    authStore.setStudentLogin(
        response
    )  

    linked.value =
      Boolean(
        response.linked
      )

    student.value =
      response.student ||
      null

    enrollments.value =
      response.dashboard
        ?.enrollments || []

    packages.value =
      response.dashboard
        ?.packages || []

    attendanceRecords.value =
      response.dashboard
        ?.attendanceRecords ||
      []

    bankAccount.value =
      response.dashboard
        ?.bankAccount ||
      null
  } catch (error) {
    console.error(
      'Student login error:',
      error
    )

    errorMessage.value =
      error?.data
        ?.statusMessage ||
      error?.statusMessage ||
      error?.message ||
      '學生端登入失敗'
  } finally {
    loginLoading.value = false
    loading.value = false
  }
}

const retryLogin = async () => {
  loading.value = true

  await loginStudent()
}

onMounted(async () => {
  await loginStudent()
})
</script>

<template>
  <main class="student-home">
    <div
      v-if="loading"
      class="state-page"
    >
      <div class="state-card">
        <div class="loader" />

        <h2>
          正在載入課程
        </h2>

        <p>
          正在確認您的 LINE 身分。
        </p>
      </div>
    </div>

    <div
      v-else-if="errorMessage"
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
          無法進入學生端
        </h2>

        <p>
          {{ errorMessage }}
        </p>

        <button
          type="button"
          class="primary-button"
          @click="retryLogin"
        >
          重新嘗試
        </button>
      </div>
    </div>

    <div
      v-else
      class="student-container"
    >
      <header class="student-header">
        <div>
          <span>
            Tap Dance
          </span>

          <h1>
            課程紀錄
          </h1>

          <p
            v-if="student"
          >
            {{
              student.name ||
              student.display_name ||
              user?.display_name
            }}
          </p>
        </div>

        <div class="avatar">
          <img
            v-if="
              user?.picture_url
            "
            :src="
              user.picture_url
            "
            alt="LINE 頭像"
          >

          <img
            v-else
            src="/favicon.png"
            alt="Tap Dance"
          >
        </div>
      </header>

      <section
        v-if="!linked"
        class="link-card"
      >
        <div class="link-card__icon">
          !
        </div>

        <div>
          <h2>
            尚未綁定學生資料
          </h2>

          <p>
            您已成功使用 LINE 登入，但目前這個 LINE 帳號還沒有連結老師建立的學生資料。
          </p>
        </div>

        <NuxtLink
          to="/student/link"
          class="primary-link"
        >
          綁定學生資料
        </NuxtLink>
      </section>

      <template v-else>
        <section class="course-card">
          <div class="course-card__top">
            <div>
              <span>
                Current Course
              </span>

              <h2>
                {{ courseName }}
              </h2>

              <p>
                {{ scheduleText }}
              </p>
            </div>

            <div class="cycle-badge">
              第
              {{
                activePackage
                  ?.cycle_no ||
                1
              }}
              期
            </div>
          </div>
        </section>

        <section class="progress-card">
          <div class="progress-header">
            <div>
              <span>
                本期課程
              </span>

              <strong>
                {{ usedSessions }}
                /
                {{ totalSessions }}
              </strong>
            </div>

            <div class="remaining">
              剩餘
              <strong>
                {{
                  remainingSessions
                }}
              </strong>
              堂
            </div>
          </div>

          <div class="progress-track">
            <div
              class="progress-value"
              :style="{
                width:
                  `${progressPercentage}%`,
              }"
            />
          </div>

          <div class="progress-footer">
            <span>
              {{
                progressPercentage
              }}%
            </span>

            <span>
              課程費用 NT$
              {{
                formatMoney(
                  activePackage
                    ?.price
                )
              }}
            </span>
          </div>

          <div
            v-if="
              activePackage &&
              remainingSessions === 0
            "
            class="completed-notice"
          >
            本期堂數已完成，等待老師確認續期並開啟下一期。
          </div>
        </section>

        <section class="quick-actions">
          <NuxtLink
            to="/student/attendance"
            class="quick-action"
          >
            <span class="quick-action__icon">
              ✓
            </span>

            <strong>
              上課紀錄
            </strong>

            <small>
              查看與修改本人紀錄
            </small>
          </NuxtLink>

          <NuxtLink
            to="/student/leave"
            class="quick-action"
          >
            <span class="quick-action__icon">
              假
            </span>

            <strong>
              請假
            </strong>

            <small>
              單次或批次請假
            </small>
          </NuxtLink>

          <NuxtLink
            to="/student/makeup"
            class="quick-action"
          >
            <span class="quick-action__icon">
              補
            </span>

            <strong>
              補課
            </strong>

            <small>
              查看可補課時段
            </small>
          </NuxtLink>

          <NuxtLink
            to="/student/history"
            class="quick-action"
          >
            <span class="quick-action__icon">
              歷
            </span>

            <strong>
              歷史紀錄
            </strong>

            <small>
              查詢過去課程
            </small>
          </NuxtLink>
        </section>

        <section
          v-if="bankAccount"
          class="bank-card"
        >
          <div>
            <span>
              繳費資訊
            </span>

            <h3>
              {{
                bankAccount.bank_name ||
                '銀行帳戶'
              }}
            </h3>
          </div>

          <div class="bank-detail">
            <span>
              {{
                bankAccount.bank_code ||
                ''
              }}
            </span>

            <strong>
              {{
                bankAccount.account_number ||
                bankAccount.account_no ||
                '-'
              }}
            </strong>
          </div>
        </section>

        <section class="history-card">
          <div class="section-title">
            <div>
              <span>
                Recent
              </span>

              <h2>
                最近紀錄
              </h2>
            </div>

            <NuxtLink
              to="/student/history"
            >
              查看全部
            </NuxtLink>
          </div>

          <div
            v-if="
              attendanceRecords.length
            "
            class="history-list"
          >
            <div
              v-for="record in
                attendanceRecords"
              :key="record.id"
              class="history-item"
            >
              <div class="history-date">
                {{
                  formatDate(
                    record.class_date ||
                    record.date ||
                    record.created_at
                  )
                }}
              </div>

              <div class="history-status">
                {{
                  getAttendanceLabel(
                    record
                  )
                }}
              </div>
            </div>
          </div>

          <div
            v-else
            class="empty-state"
          >
            尚未有課程紀錄
          </div>
        </section>
      </template>
    </div>
  </main>
</template>

<style scoped>
.student-home {
  min-height: 100vh;
  padding:
    24px
    16px
    50px;
  background: #f7f7f7;
  color: #222222;
}

.student-container {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
}

.student-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px;
}

.student-header span {
  color: #999999;
  font-size: 13px;
  letter-spacing: 1px;
}

.student-header h1 {
  margin: 3px 0 0;
  font-size: 25px;
}

.student-header p {
  margin: 4px 0 0;
  color: #777777;
  font-size: 13px;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  background: #ffffff;
  border-radius: 50%;
  box-shadow:
    0 5px 16px
    rgb(0 0 0 / 5%);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.course-card,
.progress-card,
.bank-card,
.history-card,
.link-card {
  padding: 20px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 24px;
  box-shadow:
    0 8px 24px
    rgb(0 0 0 / 4%);
}

.course-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.course-card span,
.progress-card span,
.bank-card span,
.section-title span {
  color: #999999;
  font-size: 11px;
  letter-spacing: 0.8px;
}

.course-card h2 {
  margin: 5px 0 0;
  font-size: 21px;
}

.course-card p {
  margin: 7px 0 0;
  color: #777777;
  font-size: 13px;
}

.cycle-badge {
  flex: 0 0 auto;
  padding:
    7px
    11px;
  background: #f1f1f1;
  border-radius: 999px;
  color: #666666;
  font-size: 12px;
}

.progress-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.progress-header > div:first-child {
  display: flex;
  flex-direction: column;
}

.progress-header strong {
  margin-top: 4px;
  font-size: 29px;
}

.remaining {
  color: #777777;
  font-size: 13px;
}

.remaining strong {
  margin: 0 3px;
  font-size: 20px;
}

.progress-track {
  width: 100%;
  height: 9px;
  margin-top: 18px;
  overflow: hidden;
  background: #ededed;
  border-radius: 999px;
}

.progress-value {
  height: 100%;
  background: #222222;
  border-radius: inherit;
  transition:
    width
    0.35s ease;
}

.progress-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 9px;
}

.completed-notice {
  margin-top: 16px;
  padding: 12px;
  background: #f7f7f7;
  border-radius: 13px;
  color: #666666;
  font-size: 12px;
  line-height: 1.6;
}

.quick-actions {
  display: grid;
  grid-template-columns:
    repeat(
      2,
      minmax(0, 1fr)
    );
  gap: 12px;
}

.quick-action {
  display: flex;
  flex-direction: column;
  min-height: 128px;
  padding: 17px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 20px;
  color: inherit;
  text-decoration: none;
  box-shadow:
    0 7px 20px
    rgb(0 0 0 / 3%);
}

.quick-action__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-bottom: 15px;
  background: #222222;
  border-radius: 12px;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
}

.quick-action strong {
  font-size: 14px;
}

.quick-action small {
  margin-top: 5px;
  color: #999999;
  font-size: 11px;
  line-height: 1.5;
}

.bank-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.bank-card h3 {
  margin: 5px 0 0;
  font-size: 16px;
}

.bank-detail {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.bank-detail strong {
  margin-top: 5px;
  font-size: 14px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title h2 {
  margin: 4px 0 0;
  font-size: 18px;
}

.section-title a {
  color: #666666;
  font-size: 12px;
}

.history-list {
  margin-top: 14px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 50px;
  border-bottom: 1px solid #f0f0f0;
}

.history-item:last-child {
  border-bottom: 0;
}

.history-date {
  color: #777777;
  font-size: 13px;
}

.history-status {
  padding:
    5px
    9px;
  background: #f4f4f4;
  border-radius: 999px;
  font-size: 11px;
}

.empty-state {
  padding:
    36px
    10px
    20px;
  color: #aaaaaa;
  font-size: 13px;
  text-align: center;
}

.link-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 22px;
  text-align: center;
}

.link-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  background: #f3f3f3;
  border-radius: 50%;
  color: #555555;
  font-size: 21px;
  font-weight: 700;
}

.link-card h2 {
  margin: 17px 0 0;
  font-size: 19px;
}

.link-card p {
  margin: 10px 0 0;
  color: #777777;
  font-size: 13px;
  line-height: 1.7;
}

.primary-link,
.primary-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 46px;
  margin-top: 20px;
  border: 0;
  background: #222222;
  border-radius: 14px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.state-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height:
    calc(100vh - 80px);
}

.state-card {
  width: 100%;
  max-width: 360px;
  padding: 32px 24px;
  background: #ffffff;
  border-radius: 24px;
  text-align: center;
  box-shadow:
    0 18px 60px
    rgb(0 0 0 / 8%);
}

.state-card h2 {
  margin: 18px 0 0;
  font-size: 19px;
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

@keyframes loading {
  to {
    transform: rotate(360deg);
  }
}

@media (
  max-width: 480px
) {
  .student-home {
    padding:
      18px
      14px
      40px;
  }
}
</style>