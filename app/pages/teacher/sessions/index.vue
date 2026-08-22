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

const generating =
  ref(false)

const updatingSessionId =
  ref(null)

const errorMessage =
  ref('')

const successMessage =
  ref('')

const today =
  ref('')

const sessions =
  ref([])

const courses =
  ref([])

const schedules =
  ref([])

const summary =
  ref({
    total: 0,
    scheduled: 0,
    completed: 0,
    teacherLeave: 0,
    cancelled: 0,
  })

// ============================================================
// Filters
// ============================================================

const filters =
  reactive({
    courseId: '',
    scheduleId: '',
    status: '',
    startDate: '',
    endDate: '',
  })

// ============================================================
// Generate
// ============================================================

const showGenerateDialog =
  ref(false)

const generateForm =
  reactive({
    courseId: '',
    scheduleId: '',
    startDate: '',
    endDate: '',
  })

// ============================================================
// Toast
// ============================================================

let toastTimer =
  null

const showSuccess = (
  message
) => {
  successMessage.value =
    message

  if (
    toastTimer
  ) {
    window.clearTimeout(
      toastTimer
    )
  }

  toastTimer =
    window.setTimeout(
      () => {
        successMessage.value =
          ''
      },
      3000
    )
}

// ============================================================
// Error
// ============================================================

const getErrorMessage = (
  error,
  fallback
) => {
  return (
    error?.data
      ?.statusMessage ||
    error?.statusMessage ||
    error?.message ||
    fallback
  )
}

// ============================================================
// Date Helpers
// ============================================================

const addDays = (
  dateString,
  days
) => {
  if (
    !dateString
  ) {
    return ''
  }

  const [
    year,
    month,
    day,
  ] =
    dateString
      .split('-')
      .map(
        Number
      )

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )

  date.setUTCDate(
    date.getUTCDate() +
    days
  )

  return [
    date.getUTCFullYear(),

    String(
      date.getUTCMonth() +
      1
    ).padStart(
      2,
      '0'
    ),

    String(
      date.getUTCDate()
    ).padStart(
      2,
      '0'
    ),
  ].join('-')
}

// ============================================================
// Format Date
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
// Format Time
// ============================================================

const formatTime = (
  value
) => {
  return String(
    value ||
    ''
  ).slice(
    0,
    5
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
// Status Label
// ============================================================

const getStatusLabel = (
  value
) => {
  const map = {
    SCHEDULED:
      '已排課',

    COMPLETED:
      '已完成',

    TEACHER_LEAVE:
      '老師請假',

    CANCELLED:
      '已取消',
  }

  return (
    map[value] ||
    value ||
    '-'
  )
}

// ============================================================
// Filtered Schedules
// ============================================================

const filterSchedules =
  computed(() => {
    if (
      !filters.courseId
    ) {
      return schedules.value
    }

    return schedules.value
      .filter(
        (
          schedule
        ) => {
          return (
            String(
              schedule.course_id
            ) ===
            String(
              filters.courseId
            )
          )
        }
      )
  })

const generateSchedules =
  computed(() => {
    if (
      !generateForm.courseId
    ) {
      return schedules.value
    }

    return schedules.value
      .filter(
        (
          schedule
        ) => {
          return (
            String(
              schedule.course_id
            ) ===
            String(
              generateForm.courseId
            )
          )
        }
      )
  })

// ============================================================
// Reset Schedule when Course changes
// ============================================================

watch(
  () =>
    filters.courseId,
  () => {
    if (
      filters.scheduleId &&
      !filterSchedules.value.some(
        (
          item
        ) => {
          return (
            String(
              item.id
            ) ===
            String(
              filters.scheduleId
            )
          )
        }
      )
    ) {
      filters.scheduleId =
        ''
    }
  }
)

watch(
  () =>
    generateForm.courseId,
  () => {
    generateForm.scheduleId =
      ''
  }
)

// ============================================================
// Fetch
// ============================================================

const fetchSessions =
  async () => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/teacher/sessions',
          {
            query: {
              courseId:
                filters.courseId ||
                undefined,

              scheduleId:
                filters.scheduleId ||
                undefined,

              status:
                filters.status ||
                undefined,

              startDate:
                filters.startDate ||
                undefined,

              endDate:
                filters.endDate ||
                undefined,
            },
          }
        )

      today.value =
        response.today ||
        ''

      sessions.value =
        response.sessions ||
        []

      courses.value =
        response.courses ||
        []

      schedules.value =
        response.schedules ||
        []

      summary.value =
        response.summary ||
        summary.value

      if (
        !filters.startDate
      ) {
        filters.startDate =
          response.filters
            ?.startDate ||
          ''
      }

      if (
        !filters.endDate
      ) {
        filters.endDate =
          response.filters
            ?.endDate ||
          ''
      }
    } catch (error) {
      console.error(
        'Session 載入失敗：',
        error
      )

      errorMessage.value =
        getErrorMessage(
          error,
          '課堂資料載入失敗'
        )
    } finally {
      loading.value =
        false
    }
  }

// ============================================================
// Reset Filters
// ============================================================

const resetFilters =
  async () => {
    filters.courseId =
      ''

    filters.scheduleId =
      ''

    filters.status =
      ''

    filters.startDate =
      addDays(
        today.value,
        -30
      )

    filters.endDate =
      addDays(
        today.value,
        90
      )

    await fetchSessions()
  }

// ============================================================
// Generate Dialog
// ============================================================

const openGenerateDialog =
  () => {
    generateForm.courseId =
      ''

    generateForm.scheduleId =
      ''

    generateForm.startDate =
      today.value

    generateForm.endDate =
      addDays(
        today.value,
        90
      )

    showGenerateDialog.value =
      true
  }

// ============================================================
// Generate
// ============================================================

const generateSessions =
  async () => {
    if (
      generating.value
    ) {
      return
    }

    if (
      !generateForm.startDate ||
      !generateForm.endDate
    ) {
      errorMessage.value =
        '請選擇產生課堂的日期範圍'

      return
    }

    generating.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/teacher/sessions/generate',
          {
            method:
              'POST',

            body: {
              courseId:
                generateForm.courseId ||
                null,

              scheduleId:
                generateForm.scheduleId ||
                null,

              startDate:
                generateForm.startDate,

              endDate:
                generateForm.endDate,
            },
          }
        )

      showGenerateDialog.value =
        false

      showSuccess(
        response.message ||
        '課堂產生完成'
      )

      filters.startDate =
        generateForm.startDate

      filters.endDate =
        generateForm.endDate

      await fetchSessions()
    } catch (error) {
      console.error(
        'Session 產生失敗：',
        error
      )

      errorMessage.value =
        getErrorMessage(
          error,
          '課堂產生失敗'
        )
    } finally {
      generating.value =
        false
    }
  }

// ============================================================
// Update Session
// ============================================================

const patchSession =
  async (
    session,
    payload
  ) => {
    if (
      updatingSessionId.value
    ) {
      return
    }

    updatingSessionId.value =
      session.id

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          `/api/teacher/sessions/${session.id}`,
          {
            method:
              'PATCH',

            body:
              payload,
          }
        )

      showSuccess(
        response.message ||
        '課堂已更新'
      )

      await fetchSessions()
    } catch (error) {
      console.error(
        'Session 更新失敗：',
        error
      )

      errorMessage.value =
        getErrorMessage(
          error,
          '課堂更新失敗'
        )
    } finally {
      updatingSessionId.value =
        null
    }
  }

// ============================================================
// Status
// ============================================================

const changeStatus =
  async (
    session,
    status
  ) => {
    if (
      session.status ===
      status
    ) {
      return
    }

    let message =
      ''

    if (
      status ===
      'TEACHER_LEAVE'
    ) {
      message =
        `確定要將 ${formatDate(session.class_date)} ${session.course_name} 設為老師請假嗎？`
    } else if (
      status ===
      'CANCELLED'
    ) {
      message =
        `確定要取消 ${formatDate(session.class_date)} ${session.course_name} 嗎？`
    } else if (
      status ===
      'COMPLETED'
    ) {
      message =
        '確定要將這堂課標記為已完成嗎？'
    } else {
      message =
        '確定要將這堂課恢復成已排課嗎？'
    }

    if (
      !window.confirm(
        message
      )
    ) {
      return
    }

    await patchSession(
      session,
      {
        status,
      }
    )
  }

// ============================================================
// Note
// ============================================================

const editTeacherNote =
  async (
    session
  ) => {
    if (
      updatingSessionId.value
    ) {
      return
    }

    const note =
      window.prompt(
        '老師備註：',
        session.teacher_note ||
        ''
      )

    if (
      note === null
    ) {
      return
    }

    const normalized =
      note.trim() ||
      null

    if (
      normalized ===
      (
        session.teacher_note ||
        null
      )
    ) {
      return
    }

    await patchSession(
      session,
      {
        teacherNote:
          normalized,
      }
    )
  }

// ============================================================
// Lifecycle
// ============================================================

onMounted(
  async () => {
    await fetchSessions()
  }
)

onBeforeUnmount(
  () => {
    if (
      toastTimer
    ) {
      window.clearTimeout(
        toastTimer
      )
    }
  }
)
</script>

<template>
  <main class="sessions-page">
    <div class="container">
      <!-- ====================================================
           Header
           ==================================================== -->

      <header class="page-header">
        <div>
          <NuxtLink
            to="/teacher"
            class="back-link"
          >
            ← 老師首頁
          </NuxtLink>

          <span>
            Class Sessions
          </span>

          <h1>
            課堂管理
          </h1>

          <p>
            依固定 Schedule 產生實際上課日期，並管理老師請假、取消與課堂完成狀態。
          </p>
        </div>

        <button
          type="button"
          class="primary-button"
          @click="
            openGenerateDialog
          "
        >
          ＋ 產生課堂
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
        {{
          errorMessage
        }}
      </div>

      <!-- ====================================================
           Summary
           ==================================================== -->

      <section class="summary-grid">
        <article>
          <span>
            全部
          </span>

          <strong>
            {{
              summary.total
            }}
          </strong>
        </article>

        <article>
          <span>
            已排課
          </span>

          <strong>
            {{
              summary.scheduled
            }}
          </strong>
        </article>

        <article>
          <span>
            已完成
          </span>

          <strong>
            {{
              summary.completed
            }}
          </strong>
        </article>

        <article>
          <span>
            老師請假
          </span>

          <strong>
            {{
              summary.teacherLeave
            }}
          </strong>
        </article>

        <article>
          <span>
            已取消
          </span>

          <strong>
            {{
              summary.cancelled
            }}
          </strong>
        </article>
      </section>

      <!-- ====================================================
           Filters
           ==================================================== -->

      <section class="filter-card">
        <label>
          <span>
            Course
          </span>

          <select
            v-model="
              filters.courseId
            "
          >
            <option value="">
              全部課程
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
              {{
                course.name
              }}
            </option>
          </select>
        </label>

        <label>
          <span>
            Schedule
          </span>

          <select
            v-model="
              filters.scheduleId
            "
          >
            <option value="">
              全部時段
            </option>

            <option
              v-for="
                schedule in
                  filterSchedules
              "
              :key="
                schedule.id
              "
              :value="
                schedule.id
              "
            >
              {{
                schedule.course_name
              }}
              ・
              {{
                getWeekdayLabel(
                  schedule.weekday
                )
              }}
              ・
              {{
                formatTime(
                  schedule.start_time
                )
              }}
            </option>
          </select>
        </label>

        <label>
          <span>
            狀態
          </span>

          <select
            v-model="
              filters.status
            "
          >
            <option value="">
              全部狀態
            </option>

            <option value="SCHEDULED">
              已排課
            </option>

            <option value="COMPLETED">
              已完成
            </option>

            <option value="TEACHER_LEAVE">
              老師請假
            </option>

            <option value="CANCELLED">
              已取消
            </option>
          </select>
        </label>

        <label>
          <span>
            開始日期
          </span>

          <input
            v-model="
              filters.startDate
            "
            type="date"
          >
        </label>

        <label>
          <span>
            結束日期
          </span>

          <input
            v-model="
              filters.endDate
            "
            type="date"
          >
        </label>

        <div class="filter-actions">
          <button
            type="button"
            @click="
              resetFilters
            "
          >
            清除
          </button>

          <button
            type="button"
            class="search-button"
            @click="
              fetchSessions
            "
          >
            搜尋
          </button>
        </div>
      </section>

      <!-- ====================================================
           Sessions
           ==================================================== -->

      <section class="session-section">
        <div
          v-if="
            loading
          "
          class="empty-state"
        >
          載入中...
        </div>

        <div
          v-else-if="
            sessions.length
          "
          class="session-list"
        >
          <article
            v-for="
              session in sessions
            "
            :key="
              session.id
            "
            class="session-card"
            :class="{
              'session-card--cancelled':
                session.status ===
                  'CANCELLED',

              'session-card--teacher-leave':
                session.status ===
                  'TEACHER_LEAVE',
            }"
          >
            <!-- Header -->

            <header>
              <div>
                <span class="date">
                  {{
                    formatDate(
                      session.class_date
                    )
                  }}

                  ・

                  {{
                    getWeekdayLabel(
                      session.weekday
                    )
                  }}
                </span>

                <h3>
                  {{
                    session.course_name
                  }}
                </h3>

                <p>
                  {{
                    session.schedule_name
                  }}
                  ・
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
                </p>
              </div>

              <span
                class="status-badge"
                :class="
                  `status-${String(session.status).toLowerCase()}`
                "
              >
                {{
                  getStatusLabel(
                    session.status
                  )
                }}
              </span>
            </header>

            <!-- Attendance -->

            <div class="attendance-summary">
              <div>
                <span>
                  已上課
                </span>

                <strong>
                  {{
                    session.attended_count
                  }}
                </strong>
              </div>

              <div>
                <span>
                  請假
                </span>

                <strong>
                  {{
                    session.leave_count
                  }}
                </strong>
              </div>

              <div>
                <span>
                  缺席
                </span>

                <strong>
                  {{
                    session.absent_count
                  }}
                </strong>
              </div>

              <div>
                <span>
                  有效紀錄
                </span>

                <strong>
                  {{
                    session.active_attendance_count
                  }}
                </strong>
              </div>
            </div>

            <!-- Note -->

            <div class="teacher-note">
              <div>
                <span>
                  老師備註
                </span>

                <button
                  type="button"
                  :disabled="
                    updatingSessionId ===
                    session.id
                  "
                  @click="
                    editTeacherNote(
                      session
                    )
                  "
                >
                  修改
                </button>
              </div>

              <p>
                {{
                  session.teacher_note ||
                  '尚未填寫備註'
                }}
              </p>
            </div>

            <!-- Actions -->

            <div class="session-actions">
              <button
                v-if="
                  session.status !==
                  'SCHEDULED'
                "
                type="button"
                :disabled="
                  updatingSessionId ===
                  session.id
                "
                @click="
                  changeStatus(
                    session,
                    'SCHEDULED'
                  )
                "
              >
                恢復排課
              </button>

              <button
                v-if="
                  session.status !==
                  'COMPLETED'
                "
                type="button"
                :disabled="
                  updatingSessionId ===
                  session.id
                "
                @click="
                  changeStatus(
                    session,
                    'COMPLETED'
                  )
                "
              >
                標記完成
              </button>

              <button
                v-if="
                  session.status !==
                  'TEACHER_LEAVE'
                "
                type="button"
                class="leave-button"
                :disabled="
                  updatingSessionId ===
                  session.id
                "
                @click="
                  changeStatus(
                    session,
                    'TEACHER_LEAVE'
                  )
                "
              >
                老師請假
              </button>

              <button
                v-if="
                  session.status !==
                  'CANCELLED'
                "
                type="button"
                class="danger-button"
                :disabled="
                  updatingSessionId ===
                  session.id
                "
                @click="
                  changeStatus(
                    session,
                    'CANCELLED'
                  )
                "
              >
                取消課堂
              </button>
            </div>
          </article>
        </div>

        <div
          v-else
          class="empty-state"
        >
          目前沒有符合條件的課堂。
        </div>
      </section>
    </div>

    <!-- ======================================================
         Generate Dialog
         ====================================================== -->

    <Teleport to="body">
      <div
        v-if="
          showGenerateDialog
        "
        class="dialog-mask"
        @click.self="
          showGenerateDialog =
            false
        "
      >
        <form
          class="dialog"
          @submit.prevent="
            generateSessions
          "
        >
          <header class="dialog-header">
            <div>
              <span>
                Generate Sessions
              </span>

              <h2>
                產生實際課堂
              </h2>
            </div>

            <button
              type="button"
              :disabled="
                generating
              "
              @click="
                showGenerateDialog =
                  false
              "
            >
              ×
            </button>
          </header>

          <p class="description">
            系統會依 Class Schedule 的星期、自動建立日期範圍內的 Session。已存在的 Schedule＋日期會自動略過，不會重複建立。
          </p>

          <label>
            課程

            <select
              v-model="
                generateForm.courseId
              "
              :disabled="
                generating
              "
            >
              <option value="">
                全部 ACTIVE 課程
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
                {{
                  course.name
                }}
              </option>
            </select>
          </label>

          <label>
            固定時段

            <select
              v-model="
                generateForm.scheduleId
              "
              :disabled="
                generating
              "
            >
              <option value="">
                全部時段
              </option>

              <option
                v-for="
                  schedule in
                    generateSchedules
                "
                :key="
                  schedule.id
                "
                :value="
                  schedule.id
                "
              >
                {{
                  schedule.course_name
                }}
                ・
                {{
                  getWeekdayLabel(
                    schedule.weekday
                  )
                }}
                ・
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
              </option>
            </select>
          </label>

          <div class="date-grid">
            <label>
              開始日期

              <input
                v-model="
                  generateForm.startDate
                "
                type="date"
                required
                :disabled="
                  generating
                "
              >
            </label>

            <label>
              結束日期

              <input
                v-model="
                  generateForm.endDate
                "
                type="date"
                required
                :disabled="
                  generating
                "
              >
            </label>
          </div>

          <div class="generate-warning">
            產生課堂不會覆蓋既有 Session，也不會把已經標成老師請假、取消或完成的課堂改回 SCHEDULED。
          </div>

          <div class="dialog-actions">
            <button
              type="button"
              :disabled="
                generating
              "
              @click="
                showGenerateDialog =
                  false
              "
            >
              取消
            </button>

            <button
              type="submit"
              class="confirm-button"
              :disabled="
                generating ||
                !generateForm.startDate ||
                !generateForm.endDate
              "
            >
              {{
                generating
                  ? '產生中...'
                  : '開始產生'
              }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>

    <!-- ======================================================
         Toast
         ====================================================== -->

    <Transition name="toast">
      <div
        v-if="
          successMessage
        "
        class="toast"
      >
        {{
          successMessage
        }}
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.sessions-page {
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

/* ============================================================
   Header
   ============================================================ */

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
}

.back-link {
  display: block;
  margin-bottom: 14px;
  color: #777777;
  font-size: 11px;
  text-decoration: none;
}

.page-header > div > span {
  color: #999999;
  font-size: 10px;
  letter-spacing: 1px;
}

.page-header h1 {
  margin:
    4px
    0
    0;
}

.page-header p {
  max-width: 680px;
  margin:
    6px
    0
    0;
  color: #888888;
  font-size: 11px;
  line-height: 1.6;
}

.primary-button {
  flex: 0 0 auto;
  min-height: 42px;
  padding:
    0
    15px;
  border: 0;
  background: #222222;
  border-radius: 12px;
  color: #ffffff;
  font-size: 10px;
  cursor: pointer;
}

/* ============================================================
   Summary
   ============================================================ */

.summary-grid {
  display: grid;
  grid-template-columns:
    repeat(
      5,
      1fr
    );
  gap: 8px;
  margin-top: 20px;
}

.summary-grid article {
  padding: 14px;
  background: #ffffff;
  border-radius: 15px;
}

.summary-grid span {
  color: #999999;
  font-size: 8px;
}

.summary-grid strong {
  display: block;
  margin-top: 6px;
  font-size: 20px;
}

/* ============================================================
   Filters
   ============================================================ */

.filter-card {
  display: grid;
  grid-template-columns:
    repeat(
      5,
      minmax(
        0,
        1fr
      )
    );
  gap: 8px;
  margin-top: 14px;
  padding: 15px;
  background: #ffffff;
  border-radius: 18px;
}

.filter-card label {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-card label span {
  color: #888888;
  font-size: 8px;
}

.filter-card select,
.filter-card input {
  min-height: 39px;
  padding:
    0
    9px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 9px;
  font-size: 9px;
}

.filter-actions {
  grid-column:
    1 /
    -1;
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}

.filter-actions button {
  min-height: 35px;
  padding:
    0
    12px;
  border: 0;
  background: #eeeeee;
  border-radius: 9px;
  font-size: 9px;
}

.search-button {
  background: #222222 !important;
  color: #ffffff;
}

/* ============================================================
   Sessions
   ============================================================ */

.session-section {
  margin-top: 15px;
}

.session-list {
  display: grid;
  grid-template-columns:
    repeat(
      2,
      minmax(
        0,
        1fr
      )
    );
  gap: 10px;
}

.session-card {
  padding: 16px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 17px;
}

.session-card--cancelled {
  background: #fafafa;
}

.session-card--teacher-leave {
  background: #fffaf0;
}

.session-card > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.date {
  color: #999999;
  font-size: 8px;
}

.session-card h3 {
  margin:
    4px
    0
    0;
  font-size: 15px;
}

.session-card header p {
  margin:
    4px
    0
    0;
  color: #777777;
  font-size: 9px;
}

.status-badge {
  flex: 0 0 auto;
  padding:
    5px
    8px;
  background: #eeeeee;
  border-radius: 999px;
  font-size: 8px;
}

.status-scheduled {
  background: #eef4ff;
  color: #5079b9;
}

.status-completed {
  background: #eef8ee;
  color: #4b8e50;
}

.status-teacher_leave {
  background: #fff4dc;
  color: #97701e;
}

.status-cancelled {
  background: #fff0f0;
  color: #c94343;
}

/* ============================================================
   Attendance
   ============================================================ */

.attendance-summary {
  display: grid;
  grid-template-columns:
    repeat(
      4,
      1fr
    );
  gap: 6px;
  margin-top: 13px;
}

.attendance-summary > div {
  padding: 9px;
  background: #f7f7f7;
  border-radius: 9px;
}

.attendance-summary span {
  color: #999999;
  font-size: 7px;
}

.attendance-summary strong {
  display: block;
  margin-top: 4px;
  font-size: 13px;
}

/* ============================================================
   Note
   ============================================================ */

.teacher-note {
  margin-top: 10px;
  padding: 10px;
  background: #f7f7f7;
  border-radius: 10px;
}

.teacher-note > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.teacher-note span {
  color: #999999;
  font-size: 8px;
}

.teacher-note button {
  min-height: 25px;
  padding:
    0
    8px;
  border: 0;
  background: #ffffff;
  border-radius: 7px;
  font-size: 8px;
}

.teacher-note p {
  margin:
    6px
    0
    0;
  color: #666666;
  font-size: 9px;
  line-height: 1.5;
}

/* ============================================================
   Actions
   ============================================================ */

.session-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 11px;
}

.session-actions button {
  min-height: 32px;
  padding:
    0
    9px;
  border: 0;
  background: #eeeeee;
  border-radius: 8px;
  color: #555555;
  font-size: 8px;
}

.session-actions .leave-button {
  background: #fff4dc;
  color: #8c681d;
}

.session-actions .danger-button {
  background: #fff0f0;
  color: #c94343;
}

/* ============================================================
   Dialog
   ============================================================ */

.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background:
    rgb(
      0
      0
      0
      /
      48%
    );
}

.dialog {
  width: 100%;
  max-width: 520px;
  max-height:
    calc(
      100vh -
      36px
    );
  overflow-y: auto;
  padding: 22px;
  background: #ffffff;
  border-radius: 21px;
}

.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.dialog-header span {
  color: #999999;
  font-size: 8px;
  letter-spacing: 1px;
}

.dialog-header h2 {
  margin:
    4px
    0
    0;
}

.dialog-header button {
  width: 34px;
  height: 34px;
  border: 0;
  background: #eeeeee;
  border-radius: 50%;
}

.description {
  margin:
    14px
    0
    0;
  color: #777777;
  font-size: 9px;
  line-height: 1.7;
}

.dialog > label,
.date-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
  font-size: 9px;
}

.dialog select,
.dialog input {
  min-height: 40px;
  padding:
    0
    9px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 9px;
}

.date-grid {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 8px;
}

.generate-warning {
  margin-top: 14px;
  padding: 10px;
  background: #fff5df;
  border-radius: 10px;
  color: #89671f;
  font-size: 8px;
  line-height: 1.6;
}

.dialog-actions {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 8px;
  margin-top: 18px;
}

.dialog-actions button {
  min-height: 41px;
  border: 0;
  background: #eeeeee;
  border-radius: 10px;
}

.dialog-actions .confirm-button {
  background: #222222;
  color: #ffffff;
}

/* ============================================================
   Common
   ============================================================ */

.empty-state {
  padding: 35px;
  background: #ffffff;
  border-radius: 17px;
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

.toast {
  position: fixed;
  bottom: 25px;
  left: 50%;
  z-index: 1400;
  padding:
    10px
    18px;
  background: #222222;
  border-radius: 999px;
  color: #ffffff;
  font-size: 9px;
  transform:
    translateX(
      -50%
    );
}

button:disabled {
  opacity: 0.45;
}

@media (
  max-width: 900px
) {
  .filter-card {
    grid-template-columns:
      1fr
      1fr;
  }

  .session-list {
    grid-template-columns:
      1fr;
  }

  .summary-grid {
    grid-template-columns:
      repeat(
        3,
        1fr
      );
  }
}

@media (
  max-width: 520px
) {
  .sessions-page {
    padding:
      18px
      13px
      45px;
  }

  .page-header {
    align-items: flex-start;
  }

  .filter-card {
    grid-template-columns:
      1fr;
  }

  .summary-grid {
    grid-template-columns:
      1fr
      1fr;
  }

  .attendance-summary {
    grid-template-columns:
      1fr
      1fr;
  }

  .date-grid {
    grid-template-columns:
      1fr;
  }
}
</style>