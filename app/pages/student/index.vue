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

const renewLoadingPackageId =
  ref(null)

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
// Money
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
// Date
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
// 星期
//
// DB class_schedules.weekday：
// 1 = 星期一
// ...
// 7 = 星期日
// ============================================================

const getWeekdayLabel = (
  weekday
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
        weekday
      )
    ] ||
    ''
  )
}

// ============================================================
// Schedule
//
// 現階段仍使用 default_schedule_id 對應的單一預設時段。
// 下一次新增 student_enrollment_schedules 後，
// 再改成一門課可以顯示多個時段。
// ============================================================

const getScheduleText = (
  enrollment
) => {
  const weekday =
    enrollment
      ?.schedule_weekday

  const startTime =
    enrollment
      ?.schedule_start_time

  if (
    weekday ===
      undefined ||
    weekday ===
      null
  ) {
    return '尚未設定預設班別'
  }

  const weekdayLabel =
    getWeekdayLabel(
      weekday
    )

  if (!startTime) {
    return (
      weekdayLabel ||
      '尚未設定預設班別'
    )
  }

  return `${weekdayLabel} ${String(
    startTime
  ).slice(0, 5)}`
}

// ============================================================
// Attendance Label
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
// 找某一門 Course 最新的 Package
//
// Package API 已依：
// course_id + cycle_no DESC
// 排序。
//
// 所以同 Course 第一筆就是最新一期。
// ============================================================

const getLatestPackageByCourse =
  (
    courseId
  ) => {
    return (
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
      ) ||
      null
    )
  }

// ============================================================
// 課程卡
//
// 一個 Enrollment = 一門學生正在上的 Course。
// 每門 Course 各自配自己的最新 Package。
// ============================================================

const courseCards =
  computed(() => {
    return enrollments.value
      .filter(
        (
          enrollment
        ) => {
          return (
            !enrollment.status ||
            enrollment.status ===
              'ACTIVE'
          )
        }
      )
      .map(
        (
          enrollment
        ) => {
          const packageData =
            getLatestPackageByCourse(
              enrollment.course_id
            )

          const totalSessions =
            Number(
              packageData
                ?.total_sessions ||
              0
            )

          const attendedCount =
            Number(
              packageData
                ?.attended_count ||
              0
            )

          const remainingSessions =
            Math.max(
              totalSessions -
                attendedCount,
              0
            )

          const progressPercentage =
            totalSessions > 0
              ? Math.min(
                  Math.round(
                    (
                      attendedCount /
                      totalSessions
                    ) *
                      100
                  ),
                  100
                )
              : 0

          const canRenew =
            Boolean(
              packageData &&
              totalSessions > 0 &&
              attendedCount >=
                totalSessions &&
              packageData.status !==
                'CANCELLED'
            )

          return {
            enrollment,

            package:
              packageData,

            courseId:
              enrollment.course_id,

            courseName:
              enrollment.course_name ||
              packageData
                ?.course_name ||
              '未命名課程',

            scheduleText:
              getScheduleText(
                enrollment
              ),

            totalSessions,

            attendedCount,

            remainingSessions,

            progressPercentage,

            canRenew,
          }
        }
      )
  })

// ============================================================
// 是否完全沒有 Enrollment
// ============================================================

const hasCourses =
  computed(() => {
    return (
      courseCards.value
        .length > 0
    )
  })

// ============================================================
// Package
//
// 學生只能查自己的。
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
      // Auth
      // ======================================================

      authStore
        .setStudentLogin(
          response
        )

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
      // Enrollment
      //
      // 可以同時存在：
      //
      // 踢踏舞
      // Swing
      // Jazz
      // ...
      // ======================================================

      enrollments.value =
        response.dashboard
          ?.enrollments ||
        []

      // ======================================================
      // Attendance
      // ======================================================

      attendanceRecords.value =
        response.dashboard
          ?.attendanceRecords ||
        []

      // ======================================================
      // Bank
      // ======================================================

      bankAccount.value =
        response.dashboard
          ?.bankAccount ||
        null

      // ======================================================
      // Package
      //
      // 登入 API 的資料只當暫時值，
      // 正式資料由 /api/student/packages 覆蓋。
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
//
// 每一張 Course Card 都有自己獨立的 Renew。
// 未滿堂時按鈕根本不會顯示。
// ============================================================

const renewPackage =
  async (
    courseCard
  ) => {
    const packageData =
      courseCard?.package

    if (!packageData) {
      return
    }

    if (
      renewLoadingPackageId
        .value
    ) {
      return
    }

    // ========================================================
    // 前端再次驗證
    // ========================================================

    if (
      !courseCard.canRenew
    ) {
      errorMessage.value =
        `${courseCard.courseName} 尚未完成本期堂數，無法續期`

      return
    }

    const confirmed =
      window.confirm(
        [
          `${courseCard.courseName}`,
          '',
          `目前第 ${packageData.cycle_no || 1} 期已完成。`,
          '',
          `本期共 ${courseCard.totalSessions} 堂，已完成 ${courseCard.attendedCount} 堂。`,
          '',
          '確定已完成繳費，並開始下一期嗎？',
          '',
          `下一期將沿用 ${courseCard.totalSessions} 堂、NT$ ${formatMoney(packageData.price)}。`,
        ].join(
          '\n'
        )
      )

    if (!confirmed) {
      return
    }

    renewLoadingPackageId
      .value =
        packageData.id

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
                packageData.id,
            },
          }
        )

      renewMessage.value =
        `${courseCard.courseName}：${response.message || '續期完成'}`

      // ======================================================
      // 重新取所有 Package
      //
      // 例如只有 Swing Renew：
      //
      // 踢踏舞完全不受影響。
      // ======================================================

      await fetchPackages()
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
      renewLoadingPackageId
        .value =
          null
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
         Login Error
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
            我的課程
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
           일반 Error
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
           Renew Success
           ==================================================== -->

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

      <!-- ====================================================
           尚未綁定
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
             沒有課程
             ================================================== -->

        <section
          v-if="
            !hasCourses
          "
          class="empty-course-card"
        >
          <div class="empty-course-card__icon">
            ♪
          </div>

          <h2>
            尚未加入課程
          </h2>

          <p>
            老師尚未替您設定任何課程。
          </p>
        </section>

        <!-- ==================================================
             多課程列表
             ================================================== -->

        <section
          v-else
          class="course-list"
        >
          <article
            v-for="
              courseCard in
                courseCards
            "
            :key="
              courseCard.enrollment.id
            "
            class="course-progress-card"
          >
            <!-- ==============================================
                 Course Header
                 ============================================== -->

            <div class="course-card-header">
              <div>
                <span class="course-label">
                  Course
                </span>

                <h2>
                  {{
                    courseCard.courseName
                  }}
                </h2>

                <p>
                  {{
                    courseCard.scheduleText
                  }}
                </p>
              </div>

              <div
                v-if="
                  courseCard.package
                "
                class="cycle-badge"
              >
                第
                {{
                  courseCard
                    .package
                    .cycle_no ||
                  1
                }}
                期
              </div>
            </div>

            <!-- ==============================================
                 還沒有 Package
                 ============================================== -->

            <div
              v-if="
                !courseCard.package
              "
              class="no-package"
            >
              <strong>
                尚未建立堂數方案
              </strong>

              <p>
                已加入此課程，但老師尚未設定堂數與費用。
              </p>
            </div>

            <!-- ==============================================
                 Package Progress
                 ============================================== -->

            <template v-else>
              <div class="progress-header">
                <div>
                  <span>
                    本期課程
                  </span>

                  <strong>
                    {{
                      courseCard
                        .attendedCount
                    }}
                    /
                    {{
                      courseCard
                        .totalSessions
                    }}
                  </strong>
                </div>

                <div class="remaining">
                  剩餘

                  <strong>
                    {{
                      courseCard
                        .remainingSessions
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
                      `${courseCard.progressPercentage}%`,
                  }"
                />
              </div>

              <div class="progress-footer">
                <span>
                  {{
                    courseCard
                      .progressPercentage
                  }}%
                </span>

                <span>
                  課程費用 NT$

                  {{
                    formatMoney(
                      courseCard
                        .package
                        .price
                    )
                  }}
                </span>
              </div>

              <!-- ============================================
                   Renew

                   只有這門 Course 滿堂才顯示。
                   ============================================ -->

              <div
                v-if="
                  courseCard.canRenew
                "
                class="completed-notice"
              >
                <strong>
                  本期堂數已完成
                </strong>

                <p>
                  {{
                    courseCard.courseName
                  }}
                  本期
                  {{
                    courseCard
                      .totalSessions
                  }}
                  堂已全部完成。
                </p>

                <p>
                  如果已完成繳費，可以開始下一期。
                </p>

                <button
                  type="button"
                  class="renew-button"
                  :disabled="
                    renewLoadingPackageId ===
                    courseCard.package.id
                  "
                  @click="
                    renewPackage(
                      courseCard
                    )
                  "
                >
                  {{
                    renewLoadingPackageId ===
                    courseCard.package.id
                      ? '續期處理中...'
                      : '已繳費，開始下一期'
                  }}
                </button>
              </div>
            </template>
          </article>
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
              查詢過去所有課程
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
             Recent
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

/* ============================================================
   Header
   ============================================================ */

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

/* ============================================================
   Course List
   ============================================================ */

.course-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.course-progress-card,
.bank-card,
.history-card,
.link-card,
.empty-course-card {
  padding: 20px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 24px;
  box-shadow:
    0 8px 24px
    rgb(0 0 0 / 4%);
}

.course-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.course-label,
.course-progress-card span,
.bank-card span,
.section-title span {
  color: #999999;
  font-size: 11px;
  letter-spacing: 0.8px;
}

.course-card-header h2 {
  margin: 5px 0 0;
  font-size: 21px;
}

.course-card-header p {
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

/* ============================================================
   No Package
   ============================================================ */

.no-package {
  margin-top: 18px;
  padding: 15px;
  background: #f7f7f7;
  border-radius: 15px;
}

.no-package strong {
  font-size: 13px;
}

.no-package p {
  margin: 5px 0 0;
  color: #888888;
  font-size: 11px;
  line-height: 1.6;
}

/* ============================================================
   Progress
   ============================================================ */

.progress-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-top: 22px;
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
  padding: 12px 14px;
  background: #eef8ee;
  border-radius: 13px;
  color: #4b8e50;
  font-size: 12px;
  line-height: 1.6;
}

/* ============================================================
   Empty Courses
   ============================================================ */

.empty-course-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 34px 22px;
  text-align: center;
}

.empty-course-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  background: #f3f3f3;
  border-radius: 16px;
  color: #555555;
  font-weight: 700;
}

.empty-course-card h2 {
  margin: 17px 0 0;
  font-size: 18px;
}

.empty-course-card p {
  margin: 7px 0 0;
  color: #999999;
  font-size: 12px;
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

  .progress-footer {
    gap: 10px;
  }
}
</style>