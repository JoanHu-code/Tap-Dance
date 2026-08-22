<script setup>
const {
  user,
  authenticated,
  initialized,
  loading: authLoading,
  initializeLineAuth,
} = useLineAuth()

const {
  organization,
  courses,
  activeCourses,
  totalSchedules,

  loading,
  submitting,
  error,

  refreshCourses,
  addCourse,
  addSchedule,
  setScheduleStatus,
} = useCourses()

const weekdays = [
  {
    value: 1,
    label: '星期一',
  },
  {
    value: 2,
    label: '星期二',
  },
  {
    value: 3,
    label: '星期三',
  },
  {
    value: 4,
    label: '星期四',
  },
  {
    value: 5,
    label: '星期五',
  },
  {
    value: 6,
    label: '星期六',
  },
  {
    value: 7,
    label: '星期日',
  },
]

const showCourseDialog =
  ref(false)

const showScheduleDialog =
  ref(false)

const selectedCourse =
  ref(null)

const message =
  ref('')

const showMessage =
  ref(false)

let toastTimer = null

const courseForm =
  reactive({
    name: '',
    description: '',
  })

const scheduleForm =
  reactive({
    courseId: '',
    weekday: 1,
    startTime: '',
    endTime: '',
    name: '',
    capacity: '',
  })

const showToast =
  (text) => {
    message.value =
      text

    showMessage.value =
      true

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

const getWeekdayText =
  (weekday) => {
    return (
      weekdays.find(
        (item) =>
          item.value ===
          Number(weekday)
      )?.label ||
      ''
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

const resetCourseForm =
  () => {
    courseForm.name = ''
    courseForm.description = ''
  }

const resetScheduleForm =
  () => {
    scheduleForm.courseId =
      selectedCourse.value?.id ||
      ''

    scheduleForm.weekday =
      1

    scheduleForm.startTime =
      ''

    scheduleForm.endTime =
      ''

    scheduleForm.name =
      ''

    scheduleForm.capacity =
      ''
  }

const openCourseDialog =
  () => {
    resetCourseForm()

    showCourseDialog.value =
      true
  }

const openScheduleDialog =
  (course) => {
    selectedCourse.value =
      course

    resetScheduleForm()

    showScheduleDialog.value =
      true
  }

const closeDialogs =
  () => {
    if (
      submitting.value
    ) {
      return
    }

    showCourseDialog.value =
      false

    showScheduleDialog.value =
      false
  }

const handleCreateCourse =
  async () => {
    if (
      !courseForm.name.trim()
    ) {
      showToast(
        '請輸入課程名稱'
      )

      return
    }

    const result =
      await addCourse(
        courseForm
      )

    showToast(
      result.message
    )

    if (
      result.success
    ) {
      showCourseDialog.value =
        false
    }
  }

const handleCreateSchedule =
  async () => {
    if (
      !scheduleForm.startTime
    ) {
      showToast(
        '請設定開始時間'
      )

      return
    }

    const result =
      await addSchedule(
        scheduleForm
      )

    showToast(
      result.message
    )

    if (
      result.success
    ) {
      showScheduleDialog.value =
        false
    }
  }

const handleScheduleStatus =
  async (
    schedule
  ) => {
    const nextStatus =
      schedule.status ===
      'ACTIVE'
        ? 'INACTIVE'
        : 'ACTIVE'

    const result =
      await setScheduleStatus(
        schedule.id,
        nextStatus
      )

    showToast(
      result.message
    )
  }

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

    await refreshCourses()

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
  <main class="courses-page">
    <div
      v-if="
        authLoading ||
        !initialized
      "
      class="loading-page"
    >
      正在確認老師身分...
    </div>

    <div
      v-else-if="
        authenticated
      "
      class="page-container"
    >
      <header
        class="page-header"
      >
        <div>
          <span>
            {{
              organization?.name ||
              'TapLife Class'
            }}
          </span>

          <h1>
            課程管理
          </h1>
        </div>

        <button
          type="button"
          class="primary-button"
          @click="
            openCourseDialog
          "
        >
          ＋ 新增課程
        </button>
      </header>

      <nav
        class="teacher-nav"
      >
        <button
          type="button"
          @click="
            navigateTo(
              '/teacher'
            )
          "
        >
          學生
        </button>

        <button
          type="button"
          class="active"
        >
          課程
        </button>

        <button
          type="button"
          @click="
            navigateTo(
              '/teacher/schedule'
            )
          "
        >
          課表
        </button>

        <button
          type="button"
          @click="
            navigateTo(
              '/teacher/settings'
            )
          "
        >
          設定
        </button>
      </nav>

      <section
        class="summary-grid"
      >
        <div>
          <span>
            啟用課程
          </span>

          <strong>
            {{
              activeCourses.length
            }}
          </strong>
        </div>

        <div>
          <span>
            固定時段
          </span>

          <strong>
            {{
              totalSchedules
            }}
          </strong>
        </div>
      </section>

      <div
        v-if="loading"
        class="loading-card"
      >
        課程載入中...
      </div>

      <section
        v-else-if="
          !courses.length
        "
        class="empty-card"
      >
        <strong>
          還沒有課程
        </strong>

        <p>
          先建立第一門課程，
          再替課程增加每週固定時段。
        </p>

        <button
          type="button"
          @click="
            openCourseDialog
          "
        >
          新增第一門課程
        </button>
      </section>

      <section
        v-else
        class="course-list"
      >
        <article
          v-for="
            course in courses
          "
          :key="
            course.id
          "
          class="course-card"
        >
          <div
            class="course-card__header"
          >
            <div>
              <div
                class="course-card__title"
              >
                <h2>
                  {{
                    course.name
                  }}
                </h2>

                <span
                  :class="{
                    inactive:
                      course.status !==
                      'ACTIVE',
                  }"
                >
                  {{
                    course.status ===
                    'ACTIVE'
                      ? '啟用'
                      : '停用'
                  }}
                </span>
              </div>

              <p
                v-if="
                  course.description
                "
              >
                {{
                  course.description
                }}
              </p>
            </div>

            <button
              type="button"
              class="outline-button"
              @click="
                openScheduleDialog(
                  course
                )
              "
            >
              ＋ 新增時段
            </button>
          </div>

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
                schedule.id
              "
              class="schedule-item"
              :class="{
                'schedule-item--inactive':
                  schedule.status !==
                  'ACTIVE',
              }"
            >
              <div>
                <strong>
                  {{
                    getWeekdayText(
                      schedule.weekday
                    )
                  }}
                </strong>

                <span>
                  {{
                    formatTime(
                      schedule.startTime
                    )
                  }}

                  <template
                    v-if="
                      schedule.endTime
                    "
                  >
                    －
                    {{
                      formatTime(
                        schedule.endTime
                      )
                    }}
                  </template>
                </span>
              </div>

              <div
                class="schedule-item__meta"
              >
                <span
                  v-if="
                    schedule.name
                  "
                >
                  {{
                    schedule.name
                  }}
                </span>

                <span
                  v-if="
                    schedule.capacity
                  "
                >
                  上限
                  {{
                    schedule.capacity
                  }}
                  人
                </span>
              </div>

              <button
                type="button"
                class="status-button"
                @click="
                  handleScheduleStatus(
                    schedule
                  )
                "
              >
                {{
                  schedule.status ===
                  'ACTIVE'
                    ? '停用'
                    : '啟用'
                }}
              </button>
            </div>
          </div>

          <div
            v-else
            class="no-schedule"
          >
            尚未設定固定上課時段
          </div>
        </article>
      </section>
    </div>

    <!-- 新增課程 -->
    <Teleport to="body">
      <div
        v-if="
          showCourseDialog
        "
        class="dialog-mask"
        @click.self="
          closeDialogs
        "
      >
        <div
          class="dialog"
        >
          <h2>
            新增課程
          </h2>

          <label>
            <span>
              課程名稱
            </span>

            <input
              v-model="
                courseForm.name
              "
              type="text"
              placeholder="例如：踢踏初級"
            >
          </label>

          <label>
            <span>
              說明
            </span>

            <textarea
              v-model="
                courseForm.description
              "
              rows="4"
              placeholder="非必填"
            />
          </label>

          <div
            class="dialog-actions"
          >
            <button
              type="button"
              @click="
                closeDialogs
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
                handleCreateCourse
              "
            >
              {{
                submitting
                  ? '新增中...'
                  : '新增課程'
              }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 新增時段 -->
    <Teleport to="body">
      <div
        v-if="
          showScheduleDialog
        "
        class="dialog-mask"
        @click.self="
          closeDialogs
        "
      >
        <div
          class="dialog"
        >
          <h2>
            新增上課時段
          </h2>

          <p
            class="dialog-course-name"
          >
            {{
              selectedCourse?.name
            }}
          </p>

          <label>
            <span>
              星期
            </span>

            <select
              v-model.number="
                scheduleForm.weekday
              "
            >
              <option
                v-for="
                  weekday in weekdays
                "
                :key="
                  weekday.value
                "
                :value="
                  weekday.value
                "
              >
                {{
                  weekday.label
                }}
              </option>
            </select>
          </label>

          <div
            class="time-grid"
          >
            <label>
              <span>
                開始時間
              </span>

              <input
                v-model="
                  scheduleForm.startTime
                "
                type="time"
              >
            </label>

            <label>
              <span>
                結束時間
              </span>

              <input
                v-model="
                  scheduleForm.endTime
                "
                type="time"
              >
            </label>
          </div>

          <label>
            <span>
              時段名稱
            </span>

            <input
              v-model="
                scheduleForm.name
              "
              type="text"
              placeholder="例如：週六班"
            >
          </label>

          <label>
            <span>
              人數上限
            </span>

            <input
              v-model="
                scheduleForm.capacity
              "
              type="number"
              min="1"
              placeholder="留空代表不限"
            >
          </label>

          <div
            class="dialog-actions"
          >
            <button
              type="button"
              @click="
                closeDialogs
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
                handleCreateSchedule
              "
            >
              {{
                submitting
                  ? '新增中...'
                  : '新增時段'
              }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Transition name="toast">
      <div
        v-if="
          showMessage
        "
        class="toast"
      >
        {{ message }}
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.courses-page {
  min-height: 100vh;
  padding:
    22px
    16px
    60px;
  background: #f6f6f6;
}

.page-container {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-header span {
  color: #999999;
  font-size: 13px;
}

.page-header h1 {
  margin: 4px 0 0;
  font-size: 28px;
}

.primary-button {
  padding:
    10px
    16px;
  border: 0;
  background: #222222;
  border-radius: 12px;
  color: #ffffff;
  font-weight: 600;
}

.teacher-nav {
  display: grid;
  grid-template-columns:
    repeat(4, 1fr);
  gap: 4px;
  margin-top: 24px;
  padding: 5px;
  background: #ebebeb;
  border-radius: 15px;
}

.teacher-nav button {
  min-height: 40px;
  border: 0;
  background: transparent;
  border-radius: 11px;
  color: #888888;
  font-weight: 600;
}

.teacher-nav .active {
  background: #ffffff;
  color: #222222;
}

.summary-grid {
  display: grid;
  grid-template-columns:
    repeat(2, 1fr);
  gap: 12px;
  margin-top: 18px;
}

.summary-grid > div {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 18px;
  background: #ffffff;
  border-radius: 18px;
}

.summary-grid span {
  color: #999999;
  font-size: 12px;
}

.summary-grid strong {
  font-size: 25px;
}

.loading-card,
.empty-card {
  margin-top: 18px;
  padding: 40px 20px;
  background: #ffffff;
  border-radius: 22px;
  text-align: center;
}

.empty-card p {
  color: #999999;
}

.empty-card button {
  padding:
    10px
    16px;
  border: 0;
  background: #222222;
  border-radius: 11px;
  color: #ffffff;
}

.course-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 18px;
}

.course-card {
  padding: 20px;
  background: #ffffff;
  border-radius: 22px;
}

.course-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.course-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.course-card__title h2 {
  margin: 0;
  font-size: 19px;
}

.course-card__title span {
  padding:
    3px
    8px;
  background: #e8f6ec;
  border-radius: 999px;
  color: #378a4a;
  font-size: 10px;
}

.course-card__title span.inactive {
  background: #eeeeee;
  color: #888888;
}

.course-card p {
  margin: 7px 0 0;
  color: #999999;
  font-size: 12px;
}

.outline-button {
  flex-shrink: 0;
  padding:
    8px
    12px;
  border:
    1px solid #dddddd;
  background: #ffffff;
  border-radius: 10px;
}

.schedule-list {
  margin-top: 16px;
}

.schedule-item {
  display: grid;
  grid-template-columns:
    minmax(110px, 1fr)
    minmax(80px, 1fr)
    auto;
  gap: 12px;
  align-items: center;
  padding: 13px 0;
  border-top:
    1px solid #eeeeee;
}

.schedule-item--inactive {
  opacity: 0.5;
}

.schedule-item > div:first-child {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.schedule-item > div:first-child span,
.schedule-item__meta {
  color: #888888;
  font-size: 12px;
}

.schedule-item__meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.status-button {
  padding:
    7px
    11px;
  border: 0;
  background: #f1f1f1;
  border-radius: 9px;
  color: #666666;
}

.no-schedule {
  margin-top: 16px;
  padding: 20px;
  background: #f8f8f8;
  border-radius: 12px;
  color: #999999;
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
  background:
    rgb(0 0 0 / 45%);
}

.dialog {
  width: 100%;
  max-width: 420px;
  padding: 22px;
  background: #ffffff;
  border-radius: 22px;
}

.dialog h2 {
  margin: 0;
}

.dialog-course-name {
  margin:
    5px
    0
    20px;
  color: #999999;
}

.dialog label {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 15px;
}

.dialog label span {
  font-size: 13px;
  font-weight: 600;
}

.dialog input,
.dialog textarea,
.dialog select {
  width: 100%;
  padding:
    11px
    12px;
  border:
    1px solid #dddddd;
  background: #ffffff;
  border-radius: 10px;
  font: inherit;
}

.time-grid {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 10px;
}

.dialog-actions {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
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
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999999;
}

.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  z-index: 1200;
  padding:
    11px
    20px;
  background:
    rgb(20 20 20 / 92%);
  border-radius: 999px;
  color: #ffffff;
  transform:
    translateX(-50%);
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
  max-width: 600px
) {
  .schedule-item {
    grid-template-columns:
      1fr auto;
  }

  .schedule-item__meta {
    display: none;
  }

  .time-grid {
    grid-template-columns:
      1fr;
  }
}
</style>