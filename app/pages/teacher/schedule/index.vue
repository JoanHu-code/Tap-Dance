<script setup>
definePageMeta({
  middleware:
    'teacher-auth',
})

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

const filters =
  reactive({
    courseId: '',
    scheduleId: '',
    status: '',
    startDate: '',
    endDate: '',
  })

const showGenerateDialog =
  ref(false)

const generateForm =
  reactive({
    scheduleIds: [],
    startDate: '',
    endDate: '',
  })

let toastTimer =
  null

// ============================================================
// Weekday
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
// Date / Time
// ============================================================

const formatDate = (
  value
) => {
  return value
    ? String(
        value
      )
        .slice(
          0,
          10
        )
    : '-'
}

const formatTime = (
  value
) => {
  return String(
    value || ''
  )
    .slice(
      0,
      5
    )
}

// ============================================================
// Status
// ============================================================

const getStatusLabel = (
  status
) => {
  const map = {
    SCHEDULED:
      '預定上課',

    COMPLETED:
      '已完成',

    TEACHER_LEAVE:
      '老師請假',

    CANCELLED:
      '已取消',
  }

  return (
    map[status] ||
    status
  )
}

// ============================================================
// Schedule label
// ============================================================

const getScheduleLabel = (
  schedule
) => {
  const weekday =
    getWeekdayLabel(
      schedule.weekday
    )

  const start =
    formatTime(
      schedule.start_time
    )

  const name =
    schedule.name
      ? `｜${schedule.name}`
      : ''

  return `${schedule.course_name}｜${weekday} ${start}${name}`
}

// ============================================================
// Course Filter → Schedule
// ============================================================

const filterSchedules =
  computed(() => {
    if (
      !filters.courseId
    ) {
      return schedules.value
    }

    return schedules.value.filter(
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

// ============================================================
// Toast
// ============================================================

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
      2500
    )
}

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
    } catch (error) {
      console.error(
        '課堂載入失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '課堂載入失敗'
    } finally {
      loading.value =
        false
    }
  }

// ============================================================
// Reset
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
      ''

    filters.endDate =
      ''

    await fetchSessions()
  }

// ============================================================
// Generate Dialog
// ============================================================

const openGenerateDialog =
  () => {
    generateForm.scheduleIds =
      []

    generateForm.startDate =
      ''

    generateForm.endDate =
      ''

    showGenerateDialog.value =
      true
  }

// ============================================================
// Toggle Schedule
// ============================================================

const toggleGenerateSchedule = (
  scheduleId
) => {
  const id =
    String(
      scheduleId
    )

  if (
    generateForm.scheduleIds
      .includes(
        id
      )
  ) {
    generateForm.scheduleIds =
      generateForm.scheduleIds
        .filter(
          (
            item
          ) => {
            return (
              item !== id
            )
          }
        )

    return
  }

  generateForm.scheduleIds =
    [
      ...generateForm.scheduleIds,
      id,
    ]
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
      !generateForm.scheduleIds
        .length
    ) {
      errorMessage.value =
        '請至少選擇一個固定班別'

      return
    }

    if (
      !generateForm.startDate ||
      !generateForm.endDate
    ) {
      errorMessage.value =
        '請輸入開始與結束日期'

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
              scheduleIds:
                generateForm.scheduleIds,

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

      await fetchSessions()
    } catch (error) {
      console.error(
        '產生課堂失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '產生課堂失敗'
    } finally {
      generating.value =
        false
    }
  }

// ============================================================
// Update Session
// ============================================================

const changeSessionStatus =
  async (
    session,
    status
  ) => {
    if (
      updatingSessionId.value
    ) {
      return
    }

    const nextLabel =
      getStatusLabel(
        status
      )

    if (
      !window.confirm(
        `確定將 ${session.course_name} ${formatDate(session.class_date)} 改為「${nextLabel}」嗎？`
      )
    ) {
      return
    }

    let teacherNote =
      session.teacher_note ||
      null

    if (
      status ===
        'TEACHER_LEAVE' ||
      status ===
        'CANCELLED'
    ) {
      teacherNote =
        window.prompt(
          '原因／備註，可留空：',
          session.teacher_note ||
          ''
        )
    }

    updatingSessionId.value =
      session.id

    errorMessage.value =
      ''

    try {
      await $fetch(
        `/api/teacher/sessions/${session.id}`,
        {
          method:
            'PATCH',

          body: {
            status,

            teacherNote:
              teacherNote ||
              null,
          },
        }
      )

      showSuccess(
        `課堂已更新為「${nextLabel}」`
      )

      await fetchSessions()
    } catch (error) {
      console.error(
        '課堂修改失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '課堂修改失敗'
    } finally {
      updatingSessionId.value =
        null
    }
  }

// ============================================================
// Edit Note
// ============================================================

const editNote =
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

    updatingSessionId.value =
      session.id

    try {
      await $fetch(
        `/api/teacher/sessions/${session.id}`,
        {
          method:
            'PATCH',

          body: {
            teacherNote:
              note,
          },
        }
      )

      showSuccess(
        '課堂備註已更新'
      )

      await fetchSessions()
    } catch (error) {
      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.message ||
        '備註更新失敗'
    } finally {
      updatingSessionId.value =
        null
    }
  }

watch(
  () =>
    filters.courseId,
  () => {
    if (
      filters.scheduleId &&
      !filterSchedules.value
        .some(
          (
            schedule
          ) => {
            return (
              String(
                schedule.id
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
  <main
    class="
      schedule-page
    "
  >
    <div
      class="
        container
      "
    >
      <!-- ====================================================
           Header
           ==================================================== -->

      <header
        class="
          page-header
        "
      >
        <div>
          <NuxtLink
            to="/teacher"
            class="
              back-link
            "
          >
            ← 老師首頁
          </NuxtLink>

          <span>
            Schedule
          </span>

          <h1>
            課堂管理
          </h1>

          <p>
            產生實際課堂日期、管理老師請假與課堂狀態。
          </p>
        </div>

        <button
          type="button"
          class="
            primary-button
          "
          @click="
            openGenerateDialog
          "
        >
          ＋ 產生課堂
        </button>
      </header>

      <div
        v-if="
          errorMessage
        "
        class="
          error-message
        "
      >
        {{
          errorMessage
        }}
      </div>

      <!-- ====================================================
           Summary
           ==================================================== -->

      <section
        class="
          summary-grid
        "
      >
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
            預定
          </span>

          <strong>
            {{
              summary.scheduled
            }}
          </strong>
        </article>

        <article>
          <span>
            完成
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
            取消
          </span>

          <strong>
            {{
              summary.cancelled
            }}
          </strong>
        </article>
      </section>

      <!-- ====================================================
           Filter
           ==================================================== -->

      <section
        class="
          filter-panel
        "
      >
        <select
          v-model="
            filters.courseId
          "
        >
          <option
            value=""
          >
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

        <select
          v-model="
            filters.scheduleId
          "
        >
          <option
            value=""
          >
            全部班別
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
              getScheduleLabel(
                schedule
              )
            }}
          </option>
        </select>

        <select
          v-model="
            filters.status
          "
        >
          <option value="">
            全部狀態
          </option>

          <option value="SCHEDULED">
            預定上課
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

        <input
          v-model="
            filters.startDate
          "
          type="date"
        >

        <input
          v-model="
            filters.endDate
          "
          type="date"
        >

        <div
          class="
            filter-actions
          "
        >
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
            class="
              search-button
            "
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

      <section
        class="
          session-panel
        "
      >
        <div
          v-if="
            loading
          "
          class="
            empty-state
          "
        >
          載入中...
        </div>

        <div
          v-else-if="
            sessions.length
          "
          class="
            session-list
          "
        >
          <article
            v-for="
              session in
                sessions
            "
            :key="
              session.id
            "
            class="
              session-card
            "
          >
            <div
              class="
                session-main
              "
            >
              <div>
                <span
                  class="
                    session-date
                  "
                >
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
                    formatTime(
                      session.start_time
                    )
                  }}

                  <template
                    v-if="
                      session.end_time
                    "
                  >
                    -
                    {{
                      formatTime(
                        session.end_time
                      )
                    }}
                  </template>

                  <template
                    v-if="
                      session.schedule_name
                    "
                  >
                    ・
                    {{
                      session.schedule_name
                    }}
                  </template>
                </p>

                <small
                  v-if="
                    session.teacher_note
                  "
                >
                  備註：
                  {{
                    session.teacher_note
                  }}
                </small>
              </div>

              <span
                class="
                  status-pill
                "
                :class="
                  `status-${session.status.toLowerCase()}`
                "
              >
                {{
                  getStatusLabel(
                    session.status
                  )
                }}
              </span>
            </div>

            <!-- ==============================================
                 Actions
                 ============================================== -->

            <div
              class="
                session-actions
              "
            >
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
                  changeSessionStatus(
                    session,
                    'COMPLETED'
                  )
                "
              >
                完成
              </button>

              <button
                v-if="
                  session.status !==
                  'TEACHER_LEAVE'
                "
                type="button"
                :disabled="
                  updatingSessionId ===
                  session.id
                "
                @click="
                  changeSessionStatus(
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
                class="
                  danger
                "
                :disabled="
                  updatingSessionId ===
                  session.id
                "
                @click="
                  changeSessionStatus(
                    session,
                    'CANCELLED'
                  )
                "
              >
                取消
              </button>

              <button
                v-if="
                  session.status !==
                  'SCHEDULED'
                "
                type="button"
                class="
                  restore
                "
                :disabled="
                  updatingSessionId ===
                  session.id
                "
                @click="
                  changeSessionStatus(
                    session,
                    'SCHEDULED'
                  )
                "
              >
                恢復預定
              </button>

              <button
                type="button"
                :disabled="
                  updatingSessionId ===
                  session.id
                "
                @click="
                  editNote(
                    session
                  )
                "
              >
                備註
              </button>
            </div>
          </article>
        </div>

        <div
          v-else
          class="
            empty-state
          "
        >
          尚未建立符合條件的課堂。
        </div>
      </section>
    </div>

    <!-- ======================================================
         Generate Dialog
         ====================================================== -->

    <Teleport
      to="body"
    >
      <div
        v-if="
          showGenerateDialog
        "
        class="
          dialog-mask
        "
        @click.self="
          showGenerateDialog =
            false
        "
      >
        <form
          class="
            dialog
          "
          @submit.prevent="
            generateSessions
          "
        >
          <h2>
            批次產生課堂
          </h2>

          <p
            class="
              dialog-description
            "
          >
            系統會依每個固定班別的星期，自動產生指定日期範圍內的實際課堂。
          </p>

          <div
            class="
              schedule-options
            "
          >
            <button
              v-for="
                schedule in
                  schedules
              "
              :key="
                schedule.id
              "
              type="button"
              class="
                schedule-option
              "
              :class="{
                'schedule-option--selected':
                  generateForm
                    .scheduleIds
                    .includes(
                      String(
                        schedule.id
                      )
                    ),
              }"
              @click="
                toggleGenerateSchedule(
                  schedule.id
                )
              "
            >
              <span
                class="
                  checkbox
                "
              >
                {{
                  generateForm
                    .scheduleIds
                    .includes(
                      String(
                        schedule.id
                      )
                    )
                    ? '✓'
                    : ''
                }}
              </span>

              <span>
                {{
                  getScheduleLabel(
                    schedule
                  )
                }}
              </span>
            </button>
          </div>

          <label>
            開始日期

            <input
              v-model="
                generateForm
                  .startDate
              "
              type="date"
              required
            >
          </label>

          <label>
            結束日期

            <input
              v-model="
                generateForm
                  .endDate
              "
              type="date"
              required
            >
          </label>

          <div
            class="
              dialog-actions
            "
          >
            <button
              type="button"
              @click="
                showGenerateDialog =
                  false
              "
            >
              取消
            </button>

            <button
              type="submit"
              class="
                confirm
              "
              :disabled="
                generating
              "
            >
              {{
                generating
                  ? '產生中...'
                  : '產生課堂'
              }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>

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
          toast
        "
      >
        {{
          successMessage
        }}
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.schedule-page {
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
  max-width: 1120px;
  margin: 0 auto;
}

/* ============================================================
   Header
   ============================================================ */

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.back-link {
  display: block;
  margin-bottom: 14px;
  color: #777777;
  font-size: 11px;
  text-decoration: none;
}

.page-header >
div >
span {
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
  margin:
    6px
    0
    0;
  color: #888888;
  font-size: 12px;
}

.primary-button,
.search-button {
  border: 0;
  background: #222222 !important;
  color: #ffffff;
}

.primary-button {
  min-height: 42px;
  padding:
    0
    16px;
  border-radius: 13px;
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
  gap: 10px;
  margin-top: 22px;
}

.summary-grid article {
  display: flex;
  flex-direction: column;
  padding: 15px;
  background: #ffffff;
  border-radius: 17px;
}

.summary-grid span {
  color: #999999;
  font-size: 10px;
}

.summary-grid strong {
  margin-top: 8px;
  font-size: 22px;
}

/* ============================================================
   Filter
   ============================================================ */

.filter-panel {
  display: grid;
  grid-template-columns:
    repeat(
      5,
      minmax(
        0,
        1fr
      )
    );
  gap: 9px;
  margin-top: 15px;
  padding: 17px;
  background: #ffffff;
  border-radius: 19px;
}

.filter-panel select,
.filter-panel input {
  min-height: 40px;
  padding:
    0
    9px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 10px;
  font-size: 10px;
}

.filter-actions {
  grid-column:
    1 /
    -1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.filter-actions button {
  min-height: 36px;
  padding:
    0
    13px;
  border: 0;
  background: #eeeeee;
  border-radius: 9px;
}

/* ============================================================
   Sessions
   ============================================================ */

.session-panel {
  margin-top: 15px;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.session-card {
  padding: 16px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 17px;
}

.session-main {
  display: flex;
  justify-content: space-between;
  gap: 15px;
}

.session-date {
  color: #999999;
  font-size: 10px;
}

.session-main h3 {
  margin:
    4px
    0
    0;
  font-size: 16px;
}

.session-main p {
  margin:
    5px
    0
    0;
  color: #777777;
  font-size: 11px;
}

.session-main small {
  display: block;
  margin-top: 7px;
  color: #999999;
  font-size: 10px;
}

.status-pill {
  height: fit-content;
  padding:
    6px
    9px;
  background: #f3f3f3;
  border-radius: 999px;
  font-size: 10px;
}

.status-teacher_leave {
  background: #fff4dc;
  color: #a46900;
}

.status-cancelled {
  background: #fff0f0;
  color: #c94343;
}

.status-completed {
  background: #eef8ee;
  color: #4b8e50;
}

.session-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 13px;
}

.session-actions button {
  min-height: 33px;
  padding:
    0
    11px;
  border: 0;
  background: #eeeeee;
  border-radius: 9px;
  font-size: 10px;
  cursor: pointer;
}

.session-actions button:disabled {
  opacity: 0.5;
}

.session-actions .danger {
  color: #c94343;
}

.session-actions .restore {
  background: #222222;
  color: #ffffff;
}

/* ============================================================
   Empty
   ============================================================ */

.empty-state {
  padding: 40px;
  background: #ffffff;
  border-radius: 18px;
  color: #aaaaaa;
  text-align: center;
}

/* ============================================================
   Error
   ============================================================ */

.error-message {
  margin-top: 13px;
  padding: 11px;
  background: #fff0f0;
  border-radius: 11px;
  color: #c94343;
  font-size: 11px;
}

/* ============================================================
   Dialog
   ============================================================ */

.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
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
      45%
    );
}

.dialog {
  display: flex;
  flex-direction: column;
  gap: 13px;
  width: 100%;
  max-width: 500px;
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

.dialog h2 {
  margin: 0;
}

.dialog-description {
  margin: 0;
  color: #777777;
  font-size: 11px;
  line-height: 1.6;
}

.dialog label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 10px;
}

.dialog input {
  min-height: 41px;
  padding:
    0
    10px;
  border: 1px solid #dddddd;
  border-radius: 10px;
}

/* ============================================================
   Schedule Options
   ============================================================ */

.schedule-options {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.schedule-option {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 43px;
  padding:
    8px
    10px;
  border: 1px solid #eeeeee;
  background: #f7f7f7;
  border-radius: 11px;
  color: #555555;
  text-align: left;
  cursor: pointer;
}

.schedule-option--selected {
  border-color: #222222;
  background: #f0f0f0;
}

.checkbox {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 23px;
  height: 23px;
  border: 1px solid #cccccc;
  background: #ffffff;
  border-radius: 7px;
  font-size: 10px;
}

.schedule-option--selected
.checkbox {
  border-color: #222222;
  background: #222222;
  color: #ffffff;
}

/* ============================================================
   Dialog Actions
   ============================================================ */

.dialog-actions {
  display: grid;
  grid-template-columns:
    1fr 1fr;
  gap: 8px;
  margin-top: 5px;
}

.dialog-actions button {
  min-height: 41px;
  border: 0;
  background: #eeeeee;
  border-radius: 10px;
}

.dialog-actions .confirm {
  background: #222222;
  color: #ffffff;
}

/* ============================================================
   Toast
   ============================================================ */

.toast {
  position: fixed;
  bottom: 25px;
  left: 50%;
  z-index: 1100;
  padding:
    10px
    18px;
  background: #222222;
  border-radius: 999px;
  color: #ffffff;
  font-size: 10px;
  transform:
    translateX(
      -50%
    );
}

@media (
  max-width: 800px
) {
  .summary-grid {
    grid-template-columns:
      repeat(
        2,
        1fr
      );
  }

  .filter-panel {
    grid-template-columns:
      1fr 1fr;
  }
}

@media (
  max-width: 520px
) {
  .schedule-page {
    padding:
      18px
      13px
      45px;
  }

  .page-header {
    align-items: flex-start;
  }

  .filter-panel {
    grid-template-columns:
      1fr;
  }
}
</style>