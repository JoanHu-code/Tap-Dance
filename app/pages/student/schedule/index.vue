<script setup>
definePageMeta({
  middleware:
    'student-auth',
})

const loading =
  ref(true)

const errorMessage =
  ref('')

const student =
  ref(null)

const sessions =
  ref([])

const nextClass =
  ref(null)

const upcomingTeacherLeaves =
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
// Date
// ============================================================

const formatDate = (
  value
) => {
  if (!value) {
    return '-'
  }

  return String(
    value
  )
    .slice(
      0,
      10
    )
}

// ============================================================
// Time
// ============================================================

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
    map[
      status
    ] ||
    status
  )
}

// ============================================================
// Session Groups
// ============================================================

const sessionGroups =
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
          '/api/student/calendar',
          {
            query: {
              startDate:
                filters.startDate ||
                undefined,

              endDate:
                filters.endDate ||
                undefined,
            },
          }
        )

      student.value =
        response.student ||
        null

      sessions.value =
        response.sessions ||
        []

      nextClass.value =
        response.nextClass ||
        null

      upcomingTeacherLeaves.value =
        response
          .upcomingTeacherLeaves ||
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
        '學生課表載入失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '課表載入失敗'
    } finally {
      loading.value =
        false
    }
  }

// ============================================================
// Reset
// ============================================================

const resetRange =
  async () => {
    filters.startDate =
      ''

    filters.endDate =
      ''

    await fetchCalendar()
  }

onMounted(
  async () => {
    await fetchCalendar()
  }
)
</script>

<template>
  <main
    class="
      student-schedule-page
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
            to="/student"
            class="
              back-link
            "
          >
            ← 我的課程
          </NuxtLink>

          <span>
            Schedule
          </span>

          <h1>
            我的課表
          </h1>

          <p>
            {{
              student?.name ||
              ''
            }}
          </p>
        </div>
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
           Next Class
           ==================================================== -->

      <section
        v-if="
          nextClass
        "
        class="
          next-class
        "
      >
        <span>
          Next Class
        </span>

        <div
          class="
            next-class-main
          "
        >
          <div>
            <h2>
              {{
                nextClass
                  .course_name
              }}
            </h2>

            <p>
              {{
                formatDate(
                  nextClass
                    .class_date
                )
              }}

              ・

              {{
                getWeekdayLabel(
                  nextClass
                    .weekday
                )
              }}
            </p>

            <strong>
              {{
                formatTime(
                  nextClass
                    .start_time
                )
              }}

              <template
                v-if="
                  nextClass
                    .end_time
                "
              >
                -
                {{
                  formatTime(
                    nextClass
                      .end_time
                  )
                }}
              </template>
            </strong>
          </div>

          <div
            class="
              next-badge
            "
          >
            下一堂
          </div>
        </div>
      </section>

      <section
        v-else
        class="
          no-next-class
        "
      >
        目前沒有已排定的下一堂課。
      </section>

      <!-- ====================================================
           Teacher Leave
           ==================================================== -->

      <section
        v-if="
          upcomingTeacherLeaves
            .length
        "
        class="
          leave-section
        "
      >
        <div
          class="
            section-title
          "
        >
          <span>
            Notice
          </span>

          <h2>
            老師請假
          </h2>
        </div>

        <article
          v-for="
            leave in
              upcomingTeacherLeaves
          "
          :key="
            leave.id
          "
          class="
            leave-card
          "
        >
          <div>
            <strong>
              {{
                leave.course_name
              }}
            </strong>

            <span>
              {{
                formatDate(
                  leave.class_date
                )
              }}

              ・

              {{
                getWeekdayLabel(
                  leave.weekday
                )
              }}

              ・

              {{
                formatTime(
                  leave.start_time
                )
              }}
            </span>
          </div>

          <p
            v-if="
              leave.teacher_note
            "
          >
            {{
              leave.teacher_note
            }}
          </p>
        </article>
      </section>

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
        <label>
          開始日期

          <input
            v-model="
              filters.startDate
            "
            type="date"
          >
        </label>

        <label>
          結束日期

          <input
            v-model="
              filters.endDate
            "
            type="date"
          >
        </label>

        <div
          class="
            filter-actions
          "
        >
          <button
            type="button"
            @click="
              resetRange
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
           Session List
           ==================================================== -->

      <section
        class="
          calendar-section
        "
      >
        <div
          class="
            section-title
          "
        >
          <span>
            Calendar
          </span>

          <h2>
            課堂行事曆
          </h2>
        </div>

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
            sessionGroups.length
          "
          class="
            date-groups
          "
        >
          <section
            v-for="
              group in
                sessionGroups
            "
            :key="
              group.date
            "
            class="
              date-group
            "
          >
            <h3>
              {{
                group.date
              }}
            </h3>

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
              <div>
                <span>
                  {{
                    formatTime(
                      session
                        .start_time
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
                        session
                          .end_time
                      )
                    }}
                  </template>
                </span>

                <h4>
                  {{
                    session
                      .course_name
                  }}
                </h4>

                <p
                  v-if="
                    session
                      .schedule_name
                  "
                >
                  {{
                    session
                      .schedule_name
                  }}
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

              <p
                v-if="
                  session.teacher_note
                "
                class="
                  teacher-note
                "
              >
                {{
                  session
                    .teacher_note
                }}
              </p>
            </article>
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
.student-schedule-page {
  min-height: 100vh;
  padding:
    20px
    14px
    50px;
  background: #f7f7f7;
  color: #222222;
}

.container {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
}

/* ============================================================
   Header
   ============================================================ */

.back-link {
  display: block;
  margin-bottom: 13px;
  color: #777777;
  font-size: 10px;
  text-decoration: none;
}

.page-header > div > span,
.section-title span,
.next-class > span {
  color: #999999;
  font-size: 10px;
  letter-spacing: 1px;
}

.page-header h1 {
  margin: 4px 0 0;
  font-size: 24px;
}

.page-header p {
  margin: 4px 0 0;
  color: #888888;
  font-size: 11px;
}

/* ============================================================
   Next
   ============================================================ */

.next-class {
  margin-top: 18px;
  padding: 20px;
  background: #222222;
  border-radius: 22px;
  color: #ffffff;
}

.next-class > span {
  color:
    rgb(
      255
      255
      255
      /
      55%
    );
}

.next-class-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-top: 13px;
}

.next-class h2 {
  margin: 0;
  font-size: 22px;
}

.next-class p {
  margin: 6px 0 0;
  color:
    rgb(
      255
      255
      255
      /
      68%
    );
  font-size: 11px;
}

.next-class strong {
  display: block;
  margin-top: 11px;
  font-size: 20px;
}

.next-badge {
  padding:
    6px
    9px;
  background:
    rgb(
      255
      255
      255
      /
      14%
    );
  border-radius: 999px;
  font-size: 10px;
}

.no-next-class {
  margin-top: 18px;
  padding: 20px;
  background: #ffffff;
  border-radius: 20px;
  color: #999999;
  font-size: 11px;
  text-align: center;
}

/* ============================================================
   Teacher Leave
   ============================================================ */

.leave-section {
  margin-top: 17px;
}

.section-title h2 {
  margin: 3px 0 10px;
  font-size: 17px;
}

.leave-card {
  padding: 14px;
  margin-top: 8px;
  background: #fff4dc;
  border-radius: 15px;
}

.leave-card > div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.leave-card strong {
  font-size: 12px;
}

.leave-card span {
  color: #8e6c2e;
  font-size: 10px;
}

.leave-card p {
  margin: 8px 0 0;
  color: #8e6c2e;
  font-size: 10px;
}

/* ============================================================
   Summary
   ============================================================ */

.summary-grid {
  display: grid;
  grid-template-columns:
    repeat(
      4,
      1fr
    );
  gap: 8px;
  margin-top: 17px;
}

.summary-grid article {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: #ffffff;
  border-radius: 14px;
}

.summary-grid span {
  color: #999999;
  font-size: 9px;
}

.summary-grid strong {
  margin-top: 6px;
  font-size: 18px;
}

/* ============================================================
   Filter
   ============================================================ */

.filter-card {
  display: grid;
  grid-template-columns:
    1fr 1fr;
  gap: 8px;
  margin-top: 15px;
  padding: 14px;
  background: #ffffff;
  border-radius: 17px;
}

.filter-card label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: #777777;
  font-size: 9px;
}

.filter-card input {
  min-height: 38px;
  padding:
    0
    8px;
  border: 1px solid #dddddd;
  border-radius: 9px;
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

.calendar-section {
  margin-top: 18px;
}

.date-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.date-group > h3 {
  margin:
    0
    0
    7px;
  color: #777777;
  font-size: 11px;
}

.session-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-top: 7px;
  padding: 14px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 15px;
}

.session-card--leave {
  background: #fffaf0;
}

.session-card--cancelled {
  opacity: 0.58;
}

.session-card span {
  color: #999999;
  font-size: 10px;
}

.session-card h4 {
  margin: 4px 0 0;
  font-size: 14px;
}

.session-card p {
  margin: 4px 0 0;
  color: #888888;
  font-size: 10px;
}

.status-pill {
  flex: 0 0 auto;
  padding:
    5px
    8px;
  background: #f3f3f3;
  border-radius: 999px;
  font-size: 9px;
}

.teacher-note {
  position: absolute;
  right: 14px;
  bottom: 8px;
  left: 14px;
}

.empty-state {
  padding: 30px;
  background: #ffffff;
  border-radius: 17px;
  color: #aaaaaa;
  text-align: center;
}

.error-message {
  margin-top: 12px;
  padding: 10px;
  background: #fff0f0;
  border-radius: 10px;
  color: #c94343;
  font-size: 10px;
}

@media (
  max-width: 420px
) {
  .summary-grid {
    grid-template-columns:
      1fr 1fr;
  }

  .filter-card {
    grid-template-columns:
      1fr;
  }

  .filter-actions {
    grid-column:
      auto;
  }
}
</style>