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

const renewLoadingPackageId =
  ref(null)

const errorMessage =
  ref('')

const successMessage =
  ref('')

const user =
  ref(null)

const student =
  ref(null)

const linked =
  ref(false)

const courses =
  ref([])

const attendanceRecords =
  ref([])

let messageTimer =
  null

// ============================================================
// Date
// ============================================================

const formatDate =
  (
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
// Attendance
// ============================================================

const getAttendanceLabel =
  (
    record
  ) => {
    switch (
      record?.status
    ) {
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
          record?.status ||
          '紀錄'
        )
    }
  }

// ============================================================
// Toast
// ============================================================

const showSuccess =
  (
    text
  ) => {
    successMessage.value =
      text

    if (
      messageTimer
    ) {
      window.clearTimeout(
        messageTimer
      )
    }

    messageTimer =
      window.setTimeout(
        () => {
          successMessage.value =
            ''
        },
        2600
      )
  }

// ============================================================
// Dashboard
// ============================================================

const fetchDashboard =
  async () => {
    dashboardLoading.value =
      true

    try {
      const response =
        await $fetch(
          '/api/student/dashboard'
        )

      linked.value =
        Boolean(
          response.linked
        )

      student.value =
        response.student ||
        null

      courses.value =
        response.courses ||
        []

      attendanceRecords.value =
        response
          .attendanceRecords ||
        []
    } catch (error) {
      console.error(
        '取得學生 Dashboard 失敗：',
        error
      )

      throw error
    } finally {
      dashboardLoading.value =
        false
    }
  }

// ============================================================
// Login
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

      authStore
        .setStudentLogin(
          response
        )

      user.value =
        response.user ||
        null

      await fetchDashboard()
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
  async (
    course
  ) => {
    const packageData =
      course?.package

    if (!packageData) {
      return
    }

    if (
      renewLoadingPackageId
        .value
    ) {
      return
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
          .attended_count ||
        0
      )

    // ========================================================
    // 前端再次保護
    // ========================================================

    if (
      total <= 0 ||
      attended < total
    ) {
      errorMessage.value =
        `${course.courseName} 尚未完成本期堂數`

      return
    }

    const confirmed =
      window.confirm(
        [
          course.courseName,
          '',
          `第 ${packageData.cycle_no || 1} 期已完成 ${attended}/${total} 堂。`,
          '',
          '確定已完成繳費並開始下一期嗎？',
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

      showSuccess(
        `${course.courseName}：${response.message}`
      )

      await fetchDashboard()
    } catch (error) {
      console.error(
        '續期失敗：',
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

const retry =
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

onBeforeUnmount(
  () => {
    if (
      messageTimer
    ) {
      window.clearTimeout(
        messageTimer
      )
    }
  }
)
</script>

<template>
  <main
    class="
      student-page
    "
  >
    <!-- ======================================================
         Loading
         ====================================================== -->

    <div
      v-if="
        loading ||
        dashboardLoading
      "
      class="
        state-page
      "
    >
      <div
        class="
          loader
        "
      />

      <h2>
        正在載入課程
      </h2>

      <p>
        正在取得最新課程與堂數紀錄。
      </p>
    </div>

    <!-- ======================================================
         Error
         ====================================================== -->

    <div
      v-else-if="
        errorMessage &&
        !user
      "
      class="
        state-page
      "
    >
      <div
        class="
          error-icon
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

    <!-- ======================================================
         Main
         ====================================================== -->

    <div
      v-else
      class="
        page-container
      "
    >
      <header
        class="
          page-header
        "
      >
        <div>
          <span>
            TapLife
          </span>

          <h1>
            我的課程
          </h1>

          <p
            v-if="
              student
            "
          >
            {{
              student.name
            }}
          </p>
        </div>

        <div
          class="
            avatar
          "
        >
          <img
            v-if="
              user?.picture_url
            "
            :src="
              user.picture_url
            "
            alt="LINE 頭像"
          >

          <span
            v-else
          >
            {{
              student
                ?.name
                ?.slice(
                  0,
                  1
                ) ||
              '學'
            }}
          </span>
        </div>
      </header>

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

      <Transition
        name="
          toast
        "
      >
        <div
          v-if="
            successMessage
          "
          class="
            message
            message--success
          "
        >
          {{
            successMessage
          }}
        </div>
      </Transition>

      <!-- ====================================================
           Unlinked
           ==================================================== -->

      <section
        v-if="
          !linked
        "
        class="
          unlinked-card
        "
      >
        <div
          class="
            unlinked-icon
          "
        >
          !
        </div>

        <h2>
          尚未綁定學生資料
        </h2>

        <p>
          您已完成 LINE 登入，但還沒有和老師建立的學生資料連結。
        </p>

        <NuxtLink
          to="
            /student/link
          "
          class="
            primary-link
          "
        >
          綁定學生資料
        </NuxtLink>
      </section>

      <template
        v-else
      >
        <!-- ==================================================
             Courses
             ================================================== -->

        <section
          class="
            course-section
          "
        >
          <div
            class="
              section-header
            "
          >
            <div>
              <span>
                Courses
              </span>

              <h2>
                目前課程
              </h2>
            </div>

            <strong>
              {{
                courses.length
              }}
            </strong>
          </div>

          <div
            v-if="
              courses.length
            "
            class="
              course-list
            "
          >
            <StudentCourseCard
              v-for="
                course in
                  courses
              "
              :key="
                course.enrollmentId
              "
              :course="
                course
              "
              :renew-loading-package-id="
                renewLoadingPackageId
              "
              @renew="
                renewPackage
              "
            />
          </div>

          <div
            v-else
            class="
              empty-card
            "
          >
            老師尚未替您加入任何課程。
          </div>
        </section>

        <!-- ==================================================
             Quick Menu
             ================================================== -->

        <section
          class="
            quick-grid
          "
        >
          <NuxtLink
            to="
              /student/attendance
            "
            class="
              quick-card
            "
          >
            <span>
              ✓
            </span>

            <strong>
              上課紀錄
            </strong>

            <small>
              查看與修改
            </small>
          </NuxtLink>

          <NuxtLink
            to="
              /student/leave
            "
            class="
              quick-card
            "
          >
            <span>
              假
            </span>

            <strong>
              請假
            </strong>

            <small>
              單次／批次
            </small>
          </NuxtLink>

          <NuxtLink
            to="
              /student/makeup
            "
            class="
              quick-card
            "
          >
            <span>
              補
            </span>

            <strong>
              補課
            </strong>

            <small>
              跨時段補課
            </small>
          </NuxtLink>

          <NuxtLink
            to="
              /student/history
            "
            class="
              quick-card
            "
          >
            <span>
              歷
            </span>

            <strong>
              歷史
            </strong>

            <small>
              所有課程紀錄
            </small>
          </NuxtLink>
        </section>

        <!-- ==================================================
             Recent
             ================================================== -->

        <section
          class="
            recent-card
          "
        >
          <div
            class="
              section-header
            "
          >
            <div>
              <span>
                Recent
              </span>

              <h2>
                最近紀錄
              </h2>
            </div>
          </div>

          <div
            v-if="
              attendanceRecords.length
            "
            class="
              recent-list
            "
          >
            <div
              v-for="
                record in
                  attendanceRecords
              "
              :key="
                record.id
              "
              class="
                recent-row
              "
            >
              <div>
                <strong>
                  {{
                    record.course_name ||
                    '課程'
                  }}
                </strong>

                <span>
                  {{
                    formatDate(
                      record.class_date ||
                      record.created_at
                    )
                  }}
                </span>
              </div>

              <span
                class="
                  status-badge
                "
              >
                {{
                  getAttendanceLabel(
                    record
                  )
                }}
              </span>
            </div>
          </div>

          <div
            v-else
            class="
              empty-state
            "
          >
            尚未有上課紀錄
          </div>
        </section>
      </template>
    </div>
  </main>
</template>

<style scoped>
.student-page {
  min-height: 100vh;
  padding:
    22px
    15px
    50px;
  background: #f7f7f7;
  color: #222222;
}

.page-container {
  display: flex;
  flex-direction: column;
  gap: 17px;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
}

/* ============================================================
   Header
   ============================================================ */

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding:
    4px
    3px;
}

.page-header >
div:first-child {
  display: flex;
  flex-direction: column;
}

.page-header span {
  color: #999999;
  font-size: 11px;
  letter-spacing: 1px;
}

.page-header h1 {
  margin:
    4px
    0
    0;
  font-size: 25px;
}

.page-header p {
  margin:
    4px
    0
    0;
  color: #777777;
  font-size: 12px;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 47px;
  height: 47px;
  overflow: hidden;
  background: #222222;
  border-radius: 50%;
  color: #ffffff;
  font-weight: 700;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ============================================================
   Section
   ============================================================ */

.course-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding:
    0
    3px;
}

.section-header span {
  color: #aaaaaa;
  font-size: 10px;
  letter-spacing: 1px;
}

.section-header h2 {
  margin:
    3px
    0
    0;
  font-size: 17px;
}

.section-header >
strong {
  color: #999999;
  font-size: 12px;
}

.course-list {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

/* ============================================================
   Quick
   ============================================================ */

.quick-grid {
  display: grid;
  grid-template-columns:
    repeat(
      2,
      minmax(0, 1fr)
    );
  gap: 11px;
}

.quick-card {
  display: flex;
  flex-direction: column;
  min-height: 116px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 19px;
  color: inherit;
  text-decoration: none;
}

.quick-card >
span {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin-bottom: 13px;
  background: #222222;
  border-radius: 11px;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
}

.quick-card strong {
  font-size: 13px;
}

.quick-card small {
  margin-top: 4px;
  color: #aaaaaa;
  font-size: 10px;
}

/* ============================================================
   Recent
   ============================================================ */

.recent-card {
  padding: 19px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 22px;
}

.recent-list {
  margin-top: 12px;
}

.recent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 54px;
  border-bottom: 1px solid #eeeeee;
}

.recent-row:last-child {
  border-bottom: 0;
}

.recent-row >
div {
  display: flex;
  flex-direction: column;
}

.recent-row strong {
  font-size: 12px;
}

.recent-row div span {
  margin-top: 4px;
  color: #999999;
  font-size: 10px;
}

.status-badge {
  padding:
    5px
    8px;
  background: #f3f3f3;
  border-radius: 999px;
  font-size: 10px;
}

.empty-state,
.empty-card {
  padding: 27px;
  background: #ffffff;
  border-radius: 20px;
  color: #aaaaaa;
  font-size: 11px;
  text-align: center;
}

/* ============================================================
   Unlinked
   ============================================================ */

.unlinked-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding:
    30px
    22px;
  background: #ffffff;
  border-radius: 23px;
  text-align: center;
}

.unlinked-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 51px;
  height: 51px;
  background: #eeeeee;
  border-radius: 50%;
  font-size: 20px;
}

.unlinked-card h2 {
  margin: 16px 0 0;
  font-size: 18px;
}

.unlinked-card p {
  margin: 8px 0 0;
  color: #888888;
  font-size: 12px;
  line-height: 1.7;
}

.primary-link,
.primary-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 45px;
  margin-top: 18px;
  border: 0;
  background: #222222;
  border-radius: 13px;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}

/* ============================================================
   Messages
   ============================================================ */

.message {
  padding:
    11px
    13px;
  border-radius: 12px;
  font-size: 11px;
  line-height: 1.6;
}

.message--error {
  background: #fff0f0;
  color: #c94343;
}

.message--success {
  background: #eef8ee;
  color: #4b8e50;
}

/* ============================================================
   State
   ============================================================ */

.state-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height:
    calc(
      100vh - 80px
    );
  text-align: center;
}

.state-page h2 {
  margin:
    17px
    0
    0;
}

.state-page p {
  margin:
    7px
    0
    0;
  color: #888888;
  font-size: 12px;
}

.loader {
  width: 40px;
  height: 40px;
  border: 4px solid #eeeeee;
  border-top-color: #222222;
  border-radius: 50%;
  animation:
    loading
    0.75s
    linear infinite;
}

.error-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  background: #fff0f0;
  border-radius: 50%;
  color: #d94a4a;
  font-size: 21px;
}

@keyframes loading {
  to {
    transform:
      rotate(360deg);
  }
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity
    0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}

@media (
  max-width: 480px
) {
  .student-page {
    padding:
      17px
      13px
      40px;
  }
}
</style>