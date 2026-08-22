<script setup>
definePageMeta({
  middleware:
    'teacher-auth',
})

const loading =
  ref(true)

const errorMessage =
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
    startDate: '',
    endDate: '',
  })

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
      '預定',

    COMPLETED:
      '完成',

    TEACHER_LEAVE:
      '老師請假',

    CANCELLED:
      '取消',
  }

  return (
    map[
      status
    ] ||
    status
  )
}

// ============================================================
// Filtered Schedules
// ============================================================

const availableSchedules =
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

// ============================================================
// Group By Date
// ============================================================

const dateGroups =
  computed(() => {
    const groups =
      new Map()

    for (
      const session of
      sessions.value
    ) {
      const date =
        formatDate(
          session.class_date
        )

      if (
        !groups.has(
          date
        )
      ) {
        groups.set(
          date,
          []
        )
      }

      groups
        .get(
          date
        )
        .push(
          session
        )
    }

    return Array.from(
      groups.entries()
    )
      .map(
        (
          [
            date,
            items,
          ]
        ) => {
          return {
            date,

            sessions:
              items,
          }
        }
      )
  })

// ============================================================
// Fetch
// ============================================================

const fetchCalendar =
  async () => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/teacher/calendar',
          {
            query: {
              courseId:
                filters.courseId ||
                undefined,

              scheduleId:
                filters.scheduleId ||
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

      if (
        !filters.startDate
      ) {
        filters.startDate =
          response.range
            ?.startDate ||
          ''
      }

      if (
        !filters.endDate
      ) {
        filters.endDate =
          response.range
            ?.endDate ||
          ''
      }
    } catch (error) {
      console.error(
        '老師 Calendar 載入失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '行事曆載入失敗'
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

    filters.startDate =
      ''

    filters.endDate =
      ''

    await fetchCalendar()
  }

watch(
  () =>
    filters.courseId,
  () => {
    if (
      filters.scheduleId &&
      !availableSchedules.value
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
    await fetchCalendar()
  }
)
</script>

<template>
  <main
    class="
      teacher-calendar-page
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
            Calendar
          </span>

          <h1>
            課堂行事曆
          </h1>

          <p>
            查看所有課程、老師請假與學生出席概況。
          </p>
        </div>

        <NuxtLink
          to="/teacher/schedule"
          class="
            schedule-link
          "
        >
          管理課堂
        </NuxtLink>
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
          filter-card
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
              course in
                courses
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
                availableSchedules
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

            {{
              formatTime(
                schedule.start_time
              )
            }}
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
            重設
          </button>

          <button
            type="button"
            class="
              search-button
            "
            @click="
              fetchCalendar
            "
          >
            查詢
          </button>
        </div>
      </section>

      <!-- ====================================================
           Calendar
           ==================================================== -->

      <section
        class="
          calendar-panel
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
            dateGroups.length
          "
          class="
            date-groups
          "
        >
          <section
            v-for="
              group in
                dateGroups
            "
            :key="
              group.date
            "
            class="
              date-group
            "
          >
            <div
              class="
                date-header
              "
            >
              <h2>
                {{
                  group.date
                }}
              </h2>

              <span>
                {{
                  group.sessions
                    .length
                }}
                堂
              </span>
            </div>

            <div
              class="
                session-grid
              "
            >
              <article
                v-for="
                  session in
                    group.sessions
                "
                :key="
                  session.id
                "
                class="
                  session-card
                "
                :class="{
                  'session-card--leave':
                    session.status ===
                    'TEACHER_LEAVE',

                  'session-card--cancelled':
                    session.status ===
                    'CANCELLED',
                }"
              >
                <div
                  class="
                    session-top
                  "
                >
                  <div>
                    <span>
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
                    </p>
                  </div>

                  <strong
                    class="
                      status-pill
                    "
                  >
                    {{
                      getStatusLabel(
                        session.status
                      )
                    }}
                  </strong>
                </div>

                <p
                  v-if="
                    session.schedule_name
                  "
                  class="
                    schedule-name
                  "
                >
                  {{
                    session.schedule_name
                  }}
                </p>

                <div
                  class="
                    attendance-summary
                  "
                >
                  <div>
                    <span>
                      到課
                    </span>

                    <strong>
                      {{
                        session
                          .attended_count ||
                        0
                      }}
                    </strong>
                  </div>

                  <div>
                    <span>
                      請假
                    </span>

                    <strong>
                      {{
                        session
                          .leave_count ||
                        0
                      }}
                    </strong>
                  </div>

                  <div>
                    <span>
                      缺席
                    </span>

                    <strong>
                      {{
                        session
                          .absent_count ||
                        0
                      }}
                    </strong>
                  </div>
                </div>

                <p
                  v-if="
                    session.teacher_note
                  "
                  class="
                    teacher-note
                  "
                >
                  {{
                    session.teacher_note
                  }}
                </p>
              </article>
            </div>
          </section>
        </div>

        <div
          v-else
          class="
            empty-state
          "
        >
          日期範圍內沒有課堂。
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.teacher-calendar-page {
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
  max-width: 1160px;
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
  margin:
    6px
    0
    0;
  color: #888888;
  font-size: 12px;
}

.schedule-link {
  display: flex;
  align-items: center;
  min-height: 41px;
  padding:
    0
    15px;
  background: #222222;
  border-radius: 12px;
  color: #ffffff;
  font-size: 11px;
  text-decoration: none;
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
  gap: 9px;
  margin-top: 21px;
}

.summary-grid article {
  padding: 14px;
  background: #ffffff;
  border-radius: 16px;
}

.summary-grid span {
  color: #999999;
  font-size: 9px;
}

.summary-grid strong {
  display: block;
  margin-top: 7px;
  font-size: 21px;
}

/* ============================================================
   Filter
   ============================================================ */

.filter-card {
  display: grid;
  grid-template-columns:
    1fr 1fr 1fr 1fr;
  gap: 8px;
  margin-top: 14px;
  padding: 15px;
  background: #ffffff;
  border-radius: 18px;
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
  font-size: 10px;
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
  font-size: 10px;
}

.filter-actions .search-button {
  background: #222222;
  color: #ffffff;
}

/* ============================================================
   Calendar
   ============================================================ */

.calendar-panel {
  margin-top: 16px;
}

.date-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.date-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
}

.date-header h2 {
  margin: 0;
  font-size: 16px;
}

.date-header span {
  color: #999999;
  font-size: 10px;
}

.session-grid {
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

.session-card--leave {
  background: #fffaf0;
}

.session-card--cancelled {
  opacity: 0.55;
}

.session-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.session-top span {
  color: #999999;
  font-size: 9px;
}

.session-top h3 {
  margin: 4px 0 0;
  font-size: 15px;
}

.session-top p {
  margin: 5px 0 0;
  color: #777777;
  font-size: 10px;
}

.status-pill {
  height: fit-content;
  padding:
    5px
    8px;
  background: #f2f2f2;
  border-radius: 999px;
  font-size: 9px;
}

.schedule-name {
  margin: 9px 0 0;
  color: #888888;
  font-size: 10px;
}

.attendance-summary {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 7px;
  margin-top: 13px;
  padding-top: 12px;
  border-top: 1px solid #eeeeee;
}

.attendance-summary div {
  display: flex;
  flex-direction: column;
}

.attendance-summary span {
  color: #999999;
  font-size: 9px;
}

.attendance-summary strong {
  margin-top: 4px;
  font-size: 14px;
}

.teacher-note {
  margin: 11px 0 0;
  padding: 9px;
  background:
    rgb(
      0
      0
      0
      /
      4%
    );
  border-radius: 9px;
  color: #777777;
  font-size: 10px;
}

.empty-state {
  padding: 40px;
  background: #ffffff;
  border-radius: 18px;
  color: #aaaaaa;
  text-align: center;
}

.error-message {
  margin-top: 13px;
  padding: 11px;
  background: #fff0f0;
  border-radius: 11px;
  color: #c94343;
  font-size: 11px;
}

@media (
  max-width: 760px
) {
  .summary-grid {
    grid-template-columns:
      repeat(
        2,
        1fr
      );
  }

  .filter-card {
    grid-template-columns:
      1fr 1fr;
  }

  .session-grid {
    grid-template-columns:
      1fr;
  }
}

@media (
  max-width: 480px
) {
  .teacher-calendar-page {
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
}
</style>