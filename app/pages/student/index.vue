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

const packageLoading =
  ref(false)

const renewLoading =
  ref(false)

const errorMessage =
  ref('')

const renewMessage =
  ref('')

const user =
  ref(null)

const student =
  ref(null)

const enrollments =
  ref([])

const packages =
  ref([])

const attendanceRecords =
  ref([])

const bankAccount =
  ref(null)

const linked =
  ref(false)

// ============================================================
// Current Enrollment
// ============================================================

const currentEnrollment =
  computed(() => {
    return (
      enrollments.value.find(
        (
          item
        ) => {
          return (
            !item.status ||
            item.status ===
              'ACTIVE'
          )
        }
      ) ||
      enrollments.value[0] ||
      null
    )
  })

// ============================================================
// Active / Current Package
//
// 優先找目前 Enrollment 對應 Course。
// ============================================================

const activePackage =
  computed(() => {
    const courseId =
      currentEnrollment.value
        ?.course_id

    if (courseId) {
      const sameCourseActive =
        packages.value.find(
          (
            item
          ) => {
            return (
              String(
                item.course_id
              ) ===
                String(
                  courseId
                ) &&
              item.status ===
                'ACTIVE'
            )
          }
        )

      if (
        sameCourseActive
      ) {
        return sameCourseActive
      }

      const sameCourseLatest =
        packages.value.find(
          (
            item
          ) => {
            return (
              String(
                item.course_id
              ) ===
              String(
                courseId
              )
            )
          }
        )

      if (
        sameCourseLatest
      ) {
        return sameCourseLatest
      }
    }

    return (
      packages.value.find(
        (
          item
        ) => {
          return (
            item.status ===
            'ACTIVE'
          )
        }
      ) ||
      packages.value[0] ||
      null
    )
  })

// ============================================================
// Total Sessions
// ============================================================

const totalSessions =
  computed(() => {
    return Number(
      activePackage.value
        ?.total_sessions ||
      0
    )
  })

// ============================================================
// Used Sessions
//
// 正式以 Package API 回傳的 attended_count 為主。
// ============================================================

const usedSessions =
  computed(() => {
    return Number(
      activePackage.value
        ?.attended_count ??
      activePackage.value
        ?.used_sessions ??
      0
    )
  })

// ============================================================
// Remaining
// ============================================================

const remainingSessions =
  computed(() => {
    return Math.max(
      totalSessions.value -
        usedSessions.value,
      0
    )
  })

// ============================================================
// Progress
// ============================================================

const progressPercentage =
  computed(() => {
    if (
      totalSessions.value <=
      0
    ) {
      return 0
    }

    return Math.min(
      Math.round(
        (
          usedSessions.value /
          totalSessions.value
        ) *
          100
      ),
      100
    )
  })

// ============================================================
// Can Renew
//
// 最重要：
//
// 7 / 8 → false
// 8 / 8 → true
//
// 前端只控制顯示。
// 後端仍會重新檢查。
// ============================================================

const canRenew =
  computed(() => {
    const packageData =
      activePackage.value

    if (!packageData) {
      return false
    }

    const total =
      Number(
        packageData
          .total_sessions ||
        0
      )

    const attended =
      Number(
        packageData
          .attended_count ??
        0
      )

    if (
      total <= 0
    ) {
      return false
    }

    if (
      packageData.status ===
      'CANCELLED'
    ) {
      return false
    }

    return (
      attended >= total
    )
  })

// ============================================================
// Course Name
// ============================================================

const courseName =
  computed(() => {
    return (
      currentEnrollment.value
        ?.course_name ||
      activePackage.value
        ?.course_name ||
      currentEnrollment.value
        ?.name ||
      '尚未設定課程'
    )
  })

// ============================================================
// Schedule
// ============================================================

const scheduleText =
  computed(() => {
    const weekday =
      currentEnrollment.value
        ?.schedule_weekday

    const startTime =
      currentEnrollment.value
        ?.schedule_start_time

    if (
      weekday ===
        undefined ||
      weekday ===
        null
    ) {
      return '尚未設定固定班別'
    }

    const weekdayMap = {
      1: '星期一',
      2: '星期二',
      3: '星期三',
      4: '星期四',
      5: '星期五',
      6: '星期六',
      7: '星期日',
    }

    const label =
      weekdayMap[
        Number(
          weekday
        )
      ] ||
      String(
        weekday
      )

    if (!startTime) {
      return label
    }

    return `${label} ${String(
      startTime
    ).slice(0, 5)}`
  })

// ============================================================
// Format Money
// ============================================================

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

// ============================================================
// Format Date
// ============================================================

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

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit',
      }
    )
    .format(date)
}

// ============================================================
// Attendance Status
// ============================================================

const getAttendanceLabel = (
  record
) => {
  const status =
    record?.status

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
      return (
        status ||
        '紀錄'
      )
  }
}

// ============================================================
// 取得自己的 Package
//
// 不使用 studentId。
// ============================================================

const fetchPackages =
  async () => {
    if (!linked.value) {
      packages.value = []

      return
    }

    packageLoading.value =
      true

    try {
      const response =
        await $fetch(
          '/api/student/packages'
        )

      packages.value =
        response?.packages ||
        []
    } catch (error) {
      console.error(
        '載入學生 Package 失敗：',
        error
      )

      throw error
    } finally {
      packageLoading.value =
        false
    }
  }

// ============================================================
// Student Login
// ============================================================

const loginStudent =
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
        await $liff
          .getIdToken(
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
            method:
              'POST',

            body: {
              idToken,
            },
          }
        )

      // ======================================================
      // Auth Store
      // ======================================================

      authStore
        .setStudentLogin(
          response
        )

      // ======================================================
      // User
      // ======================================================

      user.value =
        response.user ||
        null

      linked.value =
        Boolean(
          response.linked
        )

      student.value =
        response.student ||
        null

      // ======================================================
      // Dashboard 基本資料
      // ======================================================

      enrollments.value =
        response.dashboard
          ?.enrollments ||
        []

      attendanceRecords.value =
        response.dashboard
          ?.attendanceRecords ||
        []

      bankAccount.value =
        response.dashboard
          ?.bankAccount ||
        null

      // ======================================================
      // 先放登入 API 的 Package
      // 再由正式 Package API 覆蓋。
      // ======================================================

      packages.value =
        response.dashboard
          ?.packages ||
        []

      if (
        linked.value
      ) {
        await fetchPackages()
      }
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
      loginLoading.value =
        false

      loading.value =
        false
    }
  }

// ============================================================
// Renew
// ============================================================

const renewPackage =
  async () => {
    if (
      renewLoading.value
    ) {
      return
    }

    const currentPackage =
      activePackage.value

    if (!currentPackage) {
      return
    }

    // ========================================================
    // 前端第二次確認
    //
    // 不滿堂就直接停止。
    // ========================================================

    if (
      !canRenew.value
    ) {
      errorMessage.value =
        '目前堂數尚未完成，無法續期'

      return
    }

    const confirmed =
      window.confirm(
        [
          `目前第 ${currentPackage.cycle_no || 1} 期已完成。`,
          '',
          `本期共 ${totalSessions.value} 堂，已完成 ${usedSessions.value} 堂。`,
          '',
          '確定已完成繳費，並開始下一期嗎？',
          '',
          `下一期將沿用 ${totalSessions.value} 堂、NT$ ${formatMoney(currentPackage.price)}。`,
        ].join(
          '\n'
        )
      )

    if (!confirmed) {
      return
    }

    renewLoading.value =
      true

    errorMessage.value =
      ''

    renewMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/student/packages/renew',
          {
            method:
              'POST',

            body: {
              packageId:
                currentPackage.id,
            },
          }
        )

      renewMessage.value =
        response.message ||
        '續期完成'

      // ======================================================
      // 重新向 Server 取 Package
      //
      // 不自己猜資料，
      // Server 才是真實來源。
      // ======================================================

      await fetchPackages()

      // ======================================================
      // Bank Account 若下一期沿用，
      // 現有畫面可繼續使用。
      // ======================================================
    } catch (error) {
      console.error(
        '學生續期失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '續期失敗'
    } finally {
      renewLoading.value =
        false
    }
  }

// ============================================================
// Retry
// ============================================================

const retryLogin =
  async () => {
    loading.value =
      true

    await loginStudent()
  }

// ============================================================
// Mounted
// ============================================================

onMounted(
  async () => {
    await loginStudent()
  }
)
</script>

<template>
  <main class="student-home">
    <!-- ======================================================
         Loading
         ====================================================== -->

    <div
      v-if="
        loading ||
        packageLoading
      "
      class="state-page"
    >
      <div class="state-card">
        <div class="loader" />

        <h2>
          正在載入課程
        </h2>

        <p>
          正在確認您的 LINE 身分與最新課程進度。
        </p>
      </div>
    </div>

    <!-- ======================================================
         Error
         ====================================================== -->

    <div
      v-else-if="
        errorMessage &&
        !user
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
          無法進入學生端
        </h2>

        <p>
          {{
            errorMessage
          }}
        </p>

        <button
          type="button"
          class="primary-button"
          @click="
            retryLogin
          "
        >
          重新嘗試
        </button>
      </div>
    </div>

    <!-- ======================================================
         Main
         ====================================================== -->

    <div
      v-else
      class="student-container"
    >
      <!-- ====================================================
           Header
           ==================================================== -->

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

      <!-- ====================================================
           Error Notice
           ==================================================== -->

      <div
        v-if="
          errorMessage
        "
        class="
          message
          message--error
        "
      >
        {{
          errorMessage
        }}
      </div>

      <!-- ====================================================
           未綁定
           ==================================================== -->

      <section
        v-if="
          !linked
        "
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

      <!-- ====================================================
           已綁定
           ==================================================== -->

      <template v-else>
        <!-- ==================================================
             Course
             ================================================== -->

        <section class="course-card">
          <div class="course-card__top">
            <div>
              <span>
                Current Course
              </span>

              <h2>
                {{
                  courseName
                }}
              </h2>

              <p>
                {{
                  scheduleText
                }}
              </p>
            </div>

            <div
              v-if="
                activePackage
              "
              class="cycle-badge"
            >
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

        <!-- ==================================================
             Progress
             ================================================== -->

        <section class="progress-card">
          <div class="progress-header">
            <div>
              <span>
                本期課程
              </span>

              <strong>
                {{
                  usedSessions
                }}
                /
                {{
                  totalSessions
                }}
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

          <!-- ================================================
               Renew

               只有滿堂才渲染。
               7 / 8 時 DOM 裡根本沒有按鈕。
               ================================================ -->

          <div
            v-if="
              canRenew
            "
            class="completed-notice"
          >
            <strong>
              本期堂數已完成
            </strong>

            <p>
              本期共
              {{
                totalSessions
              }}
              堂，目前已完成
              {{
                usedSessions
              }}
              堂。
            </p>

            <p>
              如果已經完成繳費，可以直接開始下一期。
            </p>

            <button
              type="button"
              class="renew-button"
              :disabled="
                renewLoading
              "
              @click="
                renewPackage
              "
            >
              {{
                renewLoading
                  ? '續期處理中...'
                  : '已繳費，開始下一期'
              }}
            </button>
          </div>

          <div
            v-if="
              renewMessage
            "
            class="renew-success"
          >
            {{
              renewMessage
            }}
          </div>
        </section>

        <!-- ==================================================
             Quick Actions
             ================================================== -->

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

        <!-- ==================================================
             Bank
             ================================================== -->

        <section
          v-if="
            bankAccount
          "
          class="bank-card"
        >
          <div>
            <span>
              繳費資訊
            </span>

            <h3>
              {{
                bankAccount
                  .bank_name ||
                '銀行帳戶'
              }}
            </h3>
          </div>

          <div class="bank-detail">
            <span>
              {{
                bankAccount
                  .bank_code ||
                ''
              }}
            </span>

            <strong>
              {{
                bankAccount
                  .account_number ||
                bankAccount
                  .account_no ||
                '-'
              }}
            </strong>
          </div>
        </section>

        <!-- ==================================================
             Recent Attendance
             ================================================== -->

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
              v-for="
                record in
                  attendanceRecords
              "
              :key="
                record.id
              "
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

.progress-header >
div:first-child {
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

/* ============================================================
   Renew
   ============================================================ */

.completed-notice {
  margin-top: 16px;
  padding: 15px;
  background: #f7f7f7;
  border-radius: 15px;
  color: #666666;
  font-size: 12px;
  line-height: 1.6;
}

.completed-notice strong {
  display: block;
  color: #333333;
  font-size: 13px;
}

.completed-notice p {
  margin:
    5px
    0
    0;
}

.renew-button {
  width: 100%;
  min-height: 42px;
  margin-top: 13px;
  border: 0;
  background: #222222;
  border-radius: 13px;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.renew-button:disabled {
  cursor: default;
  opacity: 0.55;
}

.renew-success {
  margin-top: 12px;
  padding: 12px 14px;
  background: #eef8ee;
  border-radius: 13px;
  color: #4b8e50;
  font-size: 12px;
  line-height: 1.6;
}

/* ============================================================
   Quick Actions
   ============================================================ */

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

/* ============================================================
   Bank
   ============================================================ */

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

/* ============================================================
   History
   ============================================================ */

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

/* ============================================================
   Link
   ============================================================ */

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

/* ============================================================
   Message
   ============================================================ */

.message {
  padding: 12px 14px;
  border-radius: 13px;
  font-size: 12px;
  line-height: 1.6;
}

.message--error {
  background: #fff0f0;
  color: #c94343;
}

/* ============================================================
   State
   ============================================================ */

.state-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height:
    calc(
      100vh - 80px
    );
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
    loading
    0.75s
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
    transform:
      rotate(360deg);
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