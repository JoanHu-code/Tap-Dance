<script setup>
const route =
  useRoute()

const studentId =
  computed(
    () =>
      String(
        route.params.id ||
        ''
      )
  )

const {
  user,
  initialized,
  loading: authLoading,
  initializeLineAuth,
} = useLineAuth()

const {
  student,

  courses,

  enrollments,

  packages,

  bankAccounts,

  loading,

  submitting,

  error,

  refreshStudent,

  updateEnrollment,

  addPackage,
} = useTeacherStudent()

const weekdays = {
  1: '星期一',
  2: '星期二',
  3: '星期三',
  4: '星期四',
  5: '星期五',
  6: '星期六',
  7: '星期日',
}

const showEnrollmentDialog =
  ref(false)

const showPackageDialog =
  ref(false)

const message =
  ref('')

const showMessage =
  ref(false)

let toastTimer = null

const enrollmentForm =
  reactive({
    courseId: '',
    defaultScheduleId: '',
  })

const packageForm =
  reactive({
    courseId: '',

    startDate: '',

    totalSessions: 8,

    price: 3600,

    paid: false,

    bankAccountId: '',
  })

const selectedCourse =
  computed(
    () =>
      courses.value.find(
        (course) =>
          course.id ===
          enrollmentForm.courseId
      ) || null
  )

const selectedPackageCourse =
  computed(
    () =>
      courses.value.find(
        (course) =>
          course.id ===
          packageForm.courseId
      ) || null
  )

const availablePackageCourses =
  computed(() => {
    const activeCourseIds =
      new Set(
        enrollments.value
          .filter(
            (item) =>
              item.status ===
              'ACTIVE'
          )
          .map(
            (item) =>
              item.courseId
          )
      )

    return courses.value.filter(
      (course) =>
        activeCourseIds.has(
          course.id
        )
    )
  })

const showToast =
  (text) => {
    message.value = text
    showMessage.value = true

    if (toastTimer) {
      window.clearTimeout(
        toastTimer
      )
    }

    toastTimer =
      window.setTimeout(
        () => {
          showMessage.value =
            false
        },
        2500
      )
  }

const formatTime =
  (time) => {
    if (!time) {
      return ''
    }

    return String(time)
      .slice(0, 5)
  }

const formatMoney =
  (value) => {
    return new Intl.NumberFormat(
      'zh-TW'
    ).format(
      Number(value || 0)
    )
  }

const openEnrollment =
  () => {
    enrollmentForm.courseId =
      courses.value[0]?.id ||
      ''

    enrollmentForm.defaultScheduleId =
      ''

    showEnrollmentDialog.value =
      true
  }

const openPackage =
  () => {
    packageForm.courseId =
      availablePackageCourses
        .value[0]?.id ||
      ''

    const today =
      new Date()

    packageForm.startDate =
      [
        today.getFullYear(),

        String(
          today.getMonth() + 1
        ).padStart(
          2,
          '0'
        ),

        String(
          today.getDate()
        ).padStart(
          2,
          '0'
        ),
      ].join('-')

    packageForm.totalSessions =
      8

    packageForm.price =
      3600

    packageForm.paid =
      false

    packageForm.bankAccountId =
      bankAccounts.value.find(
        (item) =>
          item.isDefault
      )?.id || ''

    showPackageDialog.value =
      true
  }

const handleEnrollment =
  async () => {
    if (
      !enrollmentForm.courseId
    ) {
      showToast(
        '請選擇課程'
      )

      return
    }

    const result =
      await updateEnrollment(
        studentId.value,
        enrollmentForm
      )

    showToast(
      result.message
    )

    if (result.success) {
      showEnrollmentDialog.value =
        false
    }
  }

const handlePackage =
  async () => {
    if (
      !packageForm.courseId
    ) {
      showToast(
        '請先設定學生課程'
      )

      return
    }

    const result =
      await addPackage(
        studentId.value,
        packageForm
      )

    showToast(
      result.message
    )

    if (result.success) {
      showPackageDialog.value =
        false
    }
  }

watch(
  () =>
    enrollmentForm.courseId,

  () => {
    enrollmentForm
      .defaultScheduleId =
      ''
  }
)

onMounted(
  async () => {
    const success =
      await initializeLineAuth()

    if (!success) {
      return
    }

    if (
      user.value?.role !==
      'TEACHER'
    ) {
      await navigateTo('/')

      return
    }

    await refreshStudent(
      studentId.value
    )

    if (error.value) {
      showToast(
        error.value
      )
    }
  }
)

onBeforeUnmount(
  () => {
    if (toastTimer) {
      window.clearTimeout(
        toastTimer
      )
    }
  }
)
</script>

<template>
  <main class="student-page">
    <div
      v-if="
        authLoading ||
        !initialized ||
        loading
      "
      class="loading-page"
    >
      資料載入中...
    </div>

    <div
      v-else-if="student"
      class="page-container"
    >
      <button
        type="button"
        class="back-button"
        @click="
          navigateTo(
            '/teacher'
          )
        "
      >
        ← 返回學生列表
      </button>

      <header
        class="student-header"
      >
        <div
          class="student-avatar"
        >
          <img
            v-if="
              student.linePictureUrl
            "
            :src="
              student.linePictureUrl
            "
          >

          <span v-else>
            {{
              student.name
                .slice(0, 1)
            }}
          </span>
        </div>

        <div>
          <div
            class="student-title"
          >
            <h1>
              {{ student.name }}
            </h1>

            <span
              :class="{
                line:
                  student.hasLine,
              }"
            >
              {{
                student.hasLine
                  ? 'LINE'
                  : '手動管理'
              }}
            </span>
          </div>

          <p
            v-if="
              student.phone
            "
          >
            {{ student.phone }}
          </p>
        </div>
      </header>

      <!-- 課程 -->
      <section class="card">
        <div
          class="card-header"
        >
          <div>
            <h2>
              課程
            </h2>

            <p>
              設定學生的課程與平常固定班別
            </p>
          </div>

          <button
            type="button"
            @click="
              openEnrollment
            "
          >
            ＋ 加入課程
          </button>
        </div>

        <div
          v-if="
            enrollments.length
          "
          class="enrollment-list"
        >
          <div
            v-for="
              enrollment in
                enrollments
            "
            :key="
              enrollment.id
            "
            class="enrollment-item"
          >
            <div>
              <strong>
                {{
                  enrollment.courseName
                }}
              </strong>

              <span
                v-if="
                  enrollment.schedule
                "
              >
                {{
                  weekdays[
                    enrollment
                      .schedule
                      .weekday
                  ]
                }}

                ·

                {{
                  formatTime(
                    enrollment
                      .schedule
                      .startTime
                  )
                }}
              </span>

              <span v-else>
                尚未指定固定時段
              </span>
            </div>

            <span
              class="status"
            >
              {{
                enrollment.status ===
                'ACTIVE'
                  ? '進行中'
                  : '停用'
              }}
            </span>
          </div>
        </div>

        <div
          v-else
          class="empty"
        >
          尚未加入任何課程
        </div>
      </section>

      <!-- 堂數方案 -->
      <section class="card">
        <div
          class="card-header"
        >
          <div>
            <h2>
              堂數方案
            </h2>

            <p>
              管理起始日期、堂數、價格與付款
            </p>
          </div>

          <button
            type="button"
            @click="
              openPackage
            "
          >
            ＋ 新增方案
          </button>
        </div>

        <div
          v-if="
            packages.length
          "
          class="package-list"
        >
          <article
            v-for="
              item in packages
            "
            :key="
              item.id
            "
            class="package"
          >
            <div
              class="package__top"
            >
              <div>
                <strong>
                  {{
                    item.courseName
                  }}
                </strong>

                <span>
                  {{
                    item.startDate
                  }}
                  開始
                </span>
              </div>

              <span
                class="package-status"
                :class="{
                  completed:
                    item.status !==
                    'ACTIVE',
                }"
              >
                {{
                  item.status ===
                    'ACTIVE'
                    ? '目前方案'
                    : '歷史方案'
                }}
              </span>
            </div>

            <div
              class="progress-row"
            >
              <div>
                <strong>
                  {{
                    item.usedSessions
                  }}
                  /
                  {{
                    item.totalSessions
                  }}
                </strong>

                <span>
                  已使用
                </span>
              </div>

              <div>
                <strong>
                  {{
                    item.remainingSessions
                  }}
                </strong>

                <span>
                  剩餘堂數
                </span>
              </div>

              <div>
                <strong>
                  $
                  {{
                    formatMoney(
                      item.price
                    )
                  }}
                </strong>

                <span>
                  {{
                    item.paid
                      ? '已付款'
                      : '未付款'
                  }}
                </span>
              </div>
            </div>
          </article>
        </div>

        <div
          v-else
          class="empty"
        >
          尚未建立堂數方案
        </div>
      </section>
    </div>

    <!-- 加入課程 -->
    <Teleport to="body">
      <div
        v-if="
          showEnrollmentDialog
        "
        class="dialog-mask"
        @click.self="
          showEnrollmentDialog =
            false
        "
      >
        <div class="dialog">
          <h2>
            設定學生課程
          </h2>

          <label>
            <span>
              課程
            </span>

            <select
              v-model="
                enrollmentForm.courseId
              "
            >
              <option
                value=""
              >
                請選擇
              </option>

              <option
                v-for="
                  course in courses
                "
                :key="
                  course.id
                "
                :value="
                  course.id
                "
              >
                {{ course.name }}
              </option>
            </select>
          </label>

          <label>
            <span>
              預設上課時段
            </span>

            <select
              v-model="
                enrollmentForm
                  .defaultScheduleId
              "
            >
              <option value="">
                不指定
              </option>

              <option
                v-for="
                  schedule in
                    selectedCourse
                      ?.schedules ||
                    []
                "
                :key="
                  schedule.id
                "
                :value="
                  schedule.id
                "
              >
                {{
                  weekdays[
                    schedule.weekday
                  ]
                }}

                {{ formatTime(
                  schedule.startTime
                ) }}
              </option>
            </select>
          </label>

          <p
            class="hint"
          >
            預設時段只是平常班別，
            之後仍然可以到同一門課的其他時段補課。
          </p>

          <div
            class="dialog-actions"
          >
            <button
              type="button"
              @click="
                showEnrollmentDialog =
                  false
              "
            >
              取消
            </button>

            <button
              type="button"
              class="confirm"
              :disabled="
                submitting
              "
              @click="
                handleEnrollment
              "
            >
              儲存
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 新增方案 -->
    <Teleport to="body">
      <div
        v-if="
          showPackageDialog
        "
        class="dialog-mask"
        @click.self="
          showPackageDialog =
            false
        "
      >
        <div class="dialog">
          <h2>
            新增堂數方案
          </h2>

          <label>
            <span>
              課程
            </span>

            <select
              v-model="
                packageForm.courseId
              "
            >
              <option
                v-for="
                  course in
                    availablePackageCourses
                "
                :key="
                  course.id
                "
                :value="
                  course.id
                "
              >
                {{ course.name }}
              </option>
            </select>
          </label>

          <label>
            <span>
              起始日期
            </span>

            <input
              v-model="
                packageForm.startDate
              "
              type="date"
            >
          </label>

          <div
            class="form-grid"
          >
            <label>
              <span>
                堂數
              </span>

              <input
                v-model.number="
                  packageForm
                    .totalSessions
                "
                type="number"
                min="1"
              >
            </label>

            <label>
              <span>
                價格
              </span>

              <input
                v-model.number="
                  packageForm.price
                "
                type="number"
                min="0"
              >
            </label>
          </div>

          <label
            v-if="
              bankAccounts.length
            "
          >
            <span>
              收款帳戶
            </span>

            <select
              v-model="
                packageForm
                  .bankAccountId
              "
            >
              <option value="">
                不指定
              </option>

              <option
                v-for="
                  account in
                    bankAccounts
                "
                :key="
                  account.id
                "
                :value="
                  account.id
                "
              >
                {{
                  account.bankName
                }}
                ·
                {{
                  account.accountNumber
                }}
              </option>
            </select>
          </label>

          <label
            class="checkbox"
          >
            <input
              v-model="
                packageForm.paid
              "
              type="checkbox"
            >

            <span>
              已收到款項
            </span>
          </label>

          <div
            class="dialog-actions"
          >
            <button
              type="button"
              @click="
                showPackageDialog =
                  false
              "
            >
              取消
            </button>

            <button
              type="button"
              class="confirm"
              :disabled="
                submitting
              "
              @click="
                handlePackage
              "
            >
              建立方案
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Transition name="toast">
      <div
        v-if="showMessage"
        class="toast"
      >
        {{ message }}
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.student-page {
  min-height: 100vh;
  padding: 22px 16px 60px;
  background: #f6f6f6;
}

.page-container {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}

.back-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #777777;
  cursor: pointer;
}

.student-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
}

.student-avatar {
  display: flex;
  width: 58px;
  height: 58px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #dddddd;
  border-radius: 18px;
  font-size: 20px;
  font-weight: 700;
}

.student-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.student-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.student-title h1 {
  margin: 0;
  font-size: 25px;
}

.student-title span {
  padding: 4px 8px;
  background: #eeeeee;
  border-radius: 999px;
  color: #777777;
  font-size: 10px;
}

.student-title span.line {
  background: #e8f7ec;
  color: #378a4a;
}

.student-header p {
  margin: 4px 0 0;
  color: #999999;
  font-size: 12px;
}

.card {
  margin-top: 18px;
  padding: 21px;
  background: #ffffff;
  border-radius: 22px;
  box-shadow: 0 8px 30px rgb(0 0 0 / 4%);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card-header h2 {
  margin: 0;
  font-size: 19px;
}

.card-header p {
  margin: 5px 0 0;
  color: #999999;
  font-size: 12px;
}

.card-header button {
  flex-shrink: 0;
  padding: 8px 12px;
  border: 0;
  background: #222222;
  border-radius: 10px;
  color: #ffffff;
}

.enrollment-list,
.package-list {
  margin-top: 16px;
}

.enrollment-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 0;
  border-top: 1px solid #eeeeee;
}

.enrollment-item > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.enrollment-item span {
  color: #888888;
  font-size: 12px;
}

.enrollment-item .status {
  padding: 4px 8px;
  background: #eaf8ee;
  border-radius: 999px;
  color: #378a4a;
  font-size: 10px;
}

.package {
  padding: 16px 0;
  border-top: 1px solid #eeeeee;
}

.package__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.package__top > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.package__top span {
  color: #999999;
  font-size: 11px;
}

.package-status {
  height: fit-content;
  padding: 4px 8px;
  background: #eaf8ee;
  border-radius: 999px;
  color: #378a4a !important;
}

.package-status.completed {
  background: #eeeeee;
  color: #888888 !important;
}

.progress-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 15px;
}

.progress-row > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px;
  background: #f7f7f7;
  border-radius: 12px;
}

.progress-row strong {
  font-size: 16px;
}

.progress-row span {
  color: #999999;
  font-size: 10px;
}

.empty {
  padding: 30px 0 15px;
  color: #aaaaaa;
  font-size: 12px;
  text-align: center;
}

.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgb(0 0 0 / 45%);
}

.dialog {
  width: 100%;
  max-width: 420px;
  padding: 22px;
  background: #ffffff;
  border-radius: 22px;
}

.dialog h2 {
  margin: 0 0 18px;
}

.dialog label {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 14px;
}

.dialog label > span {
  font-size: 13px;
  font-weight: 600;
}

.dialog select,
.dialog input {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 10px;
  font: inherit;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.hint {
  padding: 10px 12px;
  background: #f7f7f7;
  border-radius: 10px;
  color: #888888;
  font-size: 11px;
  line-height: 1.6;
}

.checkbox {
  flex-direction: row !important;
  align-items: center;
}

.checkbox input {
  width: auto;
}

.dialog-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 22px;
}

.dialog-actions button {
  min-height: 44px;
  border: 0;
  background: #eeeeee;
  border-radius: 11px;
  font-weight: 600;
}

.dialog-actions .confirm {
  background: #222222;
  color: #ffffff;
}

.loading-page {
  display: flex;
  min-height: 70vh;
  align-items: center;
  justify-content: center;
  color: #999999;
}

.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  z-index: 1200;
  padding: 11px 20px;
  background: rgb(20 20 20 / 92%);
  border-radius: 999px;
  color: #ffffff;
  transform: translateX(-50%);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}

@media (max-width: 600px) {
  .progress-row {
    grid-template-columns: repeat(3, 1fr);
  }

  .progress-row > div {
    padding: 10px 7px;
  }

  .form-grid {
    grid-template-columns: 1fr 1fr;
  }

  .card-header p {
    display: none;
  }
}
</style>