<script setup>
definePageMeta({
  middleware:
    'student-auth',
})

// ============================================================
// State
// ============================================================

const loading =
  ref(true)

const saving =
  ref(false)

const errorMessage =
  ref('')

const successMessage =
  ref('')

const student =
  ref(null)

const courses =
  ref([])

const activePackages =
  ref([])

const attendance =
  ref([])

// ============================================================
// Saving Record
// ============================================================

const savingAttendanceIds =
  ref(
    new Set()
  )

const isRecordSaving = (
  id
) => {
  return savingAttendanceIds
    .value
    .has(
      String(
        id
      )
    )
}

// ============================================================
// Taipei Today
// ============================================================

const getTaipeiToday =
  () => {
    return new Intl
      .DateTimeFormat(
        'en-CA',
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
      .format(
        new Date()
      )
  }

// ============================================================
// Filter
// ============================================================

const filters =
  reactive({
    courseId: '',

    status: '',

    startDate: '',

    endDate: '',
  })

// ============================================================
// New Attendance
// ============================================================

const showCreate =
  ref(false)

const createForm =
  reactive({
    courseId: '',

    classDate:
      getTaipeiToday(),

    status:
      'ATTENDED',

    note: '',
  })

// ============================================================
// Status
// ============================================================

const statusOptions = [
  {
    value: '',
    label: '全部狀態',
  },

  {
    value:
      'ATTENDED',
    label:
      '出席',
  },

  {
    value:
      'LEAVE',
    label:
      '請假',
  },

  {
    value:
      'ABSENT',
    label:
      '缺席',
  },

  {
    value:
      'CANCELLED',
    label:
      '取消',
  },
]

const createStatusOptions = [
  {
    value:
      'ATTENDED',

    label:
      '出席',
  },

  {
    value:
      'LEAVE',

    label:
      '請假',
  },

  {
    value:
      'ABSENT',

    label:
      '缺席',
  },
]

// ============================================================
// Weekday
// ============================================================

const weekdayMap = {
  1: '星期一',
  2: '星期二',
  3: '星期三',
  4: '星期四',
  5: '星期五',
  6: '星期六',
  7: '星期日',
}

// ============================================================
// Format
// ============================================================

const formatTime = (
  value
) => {
  return String(
    value || ''
  ).slice(
    0,
    5
  )
}

const formatDate = (
  value
) => {
  return String(
    value || ''
  ).slice(
    0,
    10
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
// Selected Package
// ============================================================

const selectedCreatePackage =
  computed(() => {
    return (
      activePackages.value.find(
        (
          packageData
        ) => {
          return (
            String(
              packageData
                .course_id
            ) ===
            String(
              createForm
                .courseId
            )
          )
        }
      ) ||
      null
    )
  })

// ============================================================
// Summary
// ============================================================

const summary =
  computed(() => {
    return {
      activeCourses:
        activePackages.value
          .length,

      usedSessions:
        activePackages.value
          .reduce(
            (
              total,
              packageData
            ) => {
              return (
                total +
                Number(
                  packageData
                    .used_sessions ||
                  0
                )
              )
            },
            0
          ),

      remainingSessions:
        activePackages.value
          .reduce(
            (
              total,
              packageData
            ) => {
              return (
                total +
                Number(
                  packageData
                    .remaining_sessions ||
                  0
                )
              )
            },
            0
          ),
    }
  })

// ============================================================
// Load
// ============================================================

const loadAttendance =
  async () => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const query = {}

      if (
        filters.courseId
      ) {
        query.courseId =
          filters.courseId
      }

      if (
        filters.status
      ) {
        query.status =
          filters.status
      }

      if (
        filters.startDate
      ) {
        query.startDate =
          filters.startDate
      }

      if (
        filters.endDate
      ) {
        query.endDate =
          filters.endDate
      }

      const response =
        await $fetch(
          '/api/student/attendance',
          {
            query,
          }
        )

      student.value =
        response.student ||
        null

      courses.value =
        response.courses ||
        []

      activePackages.value =
        response.activePackages ||
        []

      attendance.value =
        response.attendance ||
        []

      if (
        !createForm.courseId &&
        activePackages.value.length
      ) {
        createForm.courseId =
          activePackages
            .value[0]
            .course_id
      }
    } catch (
      error
    ) {
      console.error(
        '學生出席紀錄載入失敗：',
        error
      )

      errorMessage.value =
        getErrorMessage(
          error,
          '出席紀錄載入失敗'
        )
    } finally {
      loading.value =
        false
    }
  }

// ============================================================
// Reset Filter
// ============================================================

const resetFilters =
  async () => {
    filters.courseId =
      ''

    filters.status =
      ''

    filters.startDate =
      ''

    filters.endDate =
      ''

    await loadAttendance()
  }

// ============================================================
// Open Create
// ============================================================

const openCreate =
  () => {
    createForm.courseId =
      activePackages.value[0]
        ?.course_id ||
      ''

    createForm.classDate =
      getTaipeiToday()

    createForm.status =
      'ATTENDED'

    createForm.note =
      ''

    showCreate.value =
      true
  }

// ============================================================
// Create Attendance
// ============================================================

const createAttendance =
  async () => {
    if (
      saving.value
    ) {
      return
    }

    if (
      !createForm.courseId
    ) {
      errorMessage.value =
        '請選擇課堂'

      return
    }

    if (
      !createForm.classDate
    ) {
      errorMessage.value =
        '請選擇日期'

      return
    }

    saving.value =
      true

    errorMessage.value =
      ''

    successMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/student/attendance',
          {
            method:
              'POST',

            body: {
              courseId:
                createForm.courseId,

              classDate:
                createForm.classDate,

              status:
                createForm.status,

              note:
                createForm.note
                  .trim() ||
                null,
            },
          }
        )

      successMessage.value =
        response.message ||
        '出席紀錄已建立'

      showCreate.value =
        false

      await loadAttendance()
    } catch (
      error
    ) {
      console.error(
        '建立出席紀錄失敗：',
        error
      )

      errorMessage.value =
        getErrorMessage(
          error,
          '建立出席紀錄失敗'
        )
    } finally {
      saving.value =
        false
    }
  }

// ============================================================
// Update Attendance
// ============================================================

const updateAttendance =
  async (
    payload
  ) => {
    const attendanceId =
      String(
        payload.attendanceId
      )

    if (
      isRecordSaving(
        attendanceId
      )
    ) {
      return
    }

    savingAttendanceIds
      .value
      .add(
        attendanceId
      )

    savingAttendanceIds.value =
      new Set(
        savingAttendanceIds.value
      )

    errorMessage.value =
      ''

    successMessage.value =
      ''

    try {
      const response =
        await $fetch(
          `/api/student/attendance/${attendanceId}`,
          {
            method:
              'PATCH',

            body: {
              status:
                payload.status,

              note:
                payload.note,
            },
          }
        )

      successMessage.value =
        response.message ||
        '出席紀錄已更新'

      await loadAttendance()
    } catch (
      error
    ) {
      console.error(
        '更新出席紀錄失敗：',
        error
      )

      errorMessage.value =
        getErrorMessage(
          error,
          '出席紀錄更新失敗'
        )
    } finally {
      savingAttendanceIds
        .value
        .delete(
          attendanceId
        )

      savingAttendanceIds.value =
        new Set(
          savingAttendanceIds.value
        )
    }
  }

// ============================================================
// Lifecycle
// ============================================================

onMounted(
  async () => {
    await loadAttendance()
  }
)
</script>

<template>
  <main class="attendance-page">
    <div class="container">
      <!-- ====================================================
           Header
           ==================================================== -->

      <header class="page-header">
        <div>
          <NuxtLink
            to="/student"
            class="back-link"
          >
            ← 我的首頁
          </NuxtLink>

          <span>
            Attendance
          </span>

          <h1>
            我的出席
          </h1>

          <p>
            {{
              student?.name ||
              ''
            }}
          </p>
        </div>

        <button
          type="button"
          class="create-button"
          :disabled="
            !activePackages.length
          "
          @click="
            openCreate
          "
        >
          ＋ 登記
        </button>
      </header>

      <!-- ====================================================
           Rule
           ==================================================== -->

      <section class="rule-card">
        <strong>
          堂數只看實際出席
        </strong>

        <p>
          出席與補課實際上課會累加 1 堂；學生請假、老師請假、缺席與取消都不會扣除方案堂數。
        </p>
      </section>

      <!-- ====================================================
           Message
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

      <div
        v-if="
          successMessage
        "
        class="success-message"
      >
        {{
          successMessage
        }}
      </div>

      <!-- ====================================================
           Summary
           ==================================================== -->

      <section class="summary-grid">
        <article>
          <span>
            進行中課堂
          </span>

          <strong>
            {{
              summary.activeCourses
            }}
          </strong>
        </article>

        <article>
          <span>
            已上
          </span>

          <strong>
            {{
              summary.usedSessions
            }}
          </strong>
        </article>

        <article>
          <span>
            剩餘
          </span>

          <strong>
            {{
              summary.remainingSessions
            }}
          </strong>
        </article>
      </section>

      <!-- ====================================================
           Active Packages
           ==================================================== -->

      <section
        v-if="
          activePackages.length
        "
        class="package-section"
      >
        <div
          v-for="
            packageData in
              activePackages
          "
          :key="
            packageData.id
          "
          class="package-card"
        >
          <div>
            <span>
              {{
                weekdayMap[
                  Number(
                    packageData.weekday
                  )
                ]
              }}
            </span>

            <strong>
              {{
                packageData.course_name
              }}
            </strong>

            <small>
              {{
                formatTime(
                  packageData.start_time
                )
              }}
              –
              {{
                formatTime(
                  packageData.end_time
                )
              }}
            </small>
          </div>

          <div>
            <span>
              進度
            </span>

            <strong>
              {{
                packageData.used_sessions
              }}
              /
              {{
                packageData.total_sessions
              }}
            </strong>

            <small>
              剩
              {{
                packageData.remaining_sessions
              }}
              堂
            </small>
          </div>
        </div>
      </section>

      <!-- ====================================================
           Filters
           ==================================================== -->

      <section class="filters">
        <label>
          <span>
            課堂
          </span>

          <select
            v-model="
              filters.courseId
            "
          >
            <option value="">
              全部課堂
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
            狀態
          </span>

          <select
            v-model="
              filters.status
            "
          >
            <option
              v-for="
                option in
                  statusOptions
              "
              :key="
                option.value
              "
              :value="
                option.value
              "
            >
              {{
                option.label
              }}
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

        <button
          type="button"
          @click="
            loadAttendance
          "
        >
          搜尋
        </button>

        <button
          type="button"
          class="secondary"
          @click="
            resetFilters
          "
        >
          清除
        </button>
      </section>

      <!-- ====================================================
           History
           ==================================================== -->

      <section class="history-section">
        <div class="section-header">
          <div>
            <span>
              History
            </span>

            <h2>
              出席紀錄
            </h2>
          </div>

          <span>
            {{
              attendance.length
            }}
            筆
          </span>
        </div>

        <div
          v-if="
            loading
          "
          class="empty-state"
        >
          載入紀錄中...
        </div>

        <div
          v-else-if="
            attendance.length
          "
          class="attendance-list"
        >
          <AttendanceRecordCard
            v-for="
              record in
                attendance
            "
            :key="
              record.id
            "
            :record="
              record
            "
            :saving="
              isRecordSaving(
                record.id
              )
            "
            @update="
              updateAttendance
            "
          />
        </div>

        <div
          v-else
          class="empty-state"
        >
          沒有符合條件的出席紀錄。
        </div>
      </section>
    </div>

    <!-- ======================================================
         Create Dialog
         ====================================================== -->

    <Teleport to="body">
      <div
        v-if="
          showCreate
        "
        class="dialog-mask"
        @click.self="
          !saving &&
          (
            showCreate =
              false
          )
        "
      >
        <form
          class="dialog"
          @submit.prevent="
            createAttendance
          "
        >
          <header>
            <div>
              <span>
                Attendance
              </span>

              <h2>
                登記出席
              </h2>
            </div>

            <button
              type="button"
              :disabled="
                saving
              "
              @click="
                showCreate =
                  false
              "
            >
              ×
            </button>
          </header>

          <!-- Course -->

          <label>
            <span>
              課堂
            </span>

            <select
              v-model="
                createForm.courseId
              "
              required
              :disabled="
                saving
              "
            >
              <option
                v-for="
                  packageData in
                    activePackages
                "
                :key="
                  packageData.id
                "
                :value="
                  packageData.course_id
                "
              >
                {{
                  packageData.course_name
                }}
                ・
                {{
                  weekdayMap[
                    Number(
                      packageData.weekday
                    )
                  ]
                }}
              </option>
            </select>
          </label>

          <!-- Package Preview -->

          <div
            v-if="
              selectedCreatePackage
            "
            class="package-preview"
          >
            <div>
              <span>
                已上
              </span>

              <strong>
                {{
                  selectedCreatePackage
                    .used_sessions
                }}
              </strong>
            </div>

            <div>
              <span>
                總堂數
              </span>

              <strong>
                {{
                  selectedCreatePackage
                    .total_sessions
                }}
              </strong>
            </div>

            <div>
              <span>
                剩餘
              </span>

              <strong>
                {{
                  selectedCreatePackage
                    .remaining_sessions
                }}
              </strong>
            </div>
          </div>

          <!-- Date -->

          <label>
            <span>
              日期
            </span>

            <input
              v-model="
                createForm.classDate
              "
              type="date"
              required
              :disabled="
                saving
              "
            >
          </label>

          <!-- Status -->

          <label>
            <span>
              狀態
            </span>

            <select
              v-model="
                createForm.status
              "
              :disabled="
                saving
              "
            >
              <option
                v-for="
                  option in
                    createStatusOptions
                "
                :key="
                  option.value
                "
                :value="
                  option.value
                "
              >
                {{
                  option.label
                }}
              </option>
            </select>
          </label>

          <!-- Note -->

          <label>
            <span>
              備註
            </span>

            <textarea
              v-model="
                createForm.note
              "
              rows="3"
              maxlength="2000"
              placeholder="選填..."
              :disabled="
                saving
              "
            />
          </label>

          <!-- Rule -->

          <div class="dialog-rule">
            <strong>
              {{
                createForm.status ===
                  'ATTENDED'
                  ? '這筆會累加 1 堂'
                  : '這筆不會扣堂數'
              }}
            </strong>

            <p>
              系統不會依日期推算第幾堂，方案只依實際 ATTENDED 累加。
            </p>
          </div>

          <!-- Footer -->

          <footer>
            <button
              type="button"
              :disabled="
                saving
              "
              @click="
                showCreate =
                  false
              "
            >
              取消
            </button>

            <button
              type="submit"
              class="confirm"
              :disabled="
                saving
              "
            >
              {{
                saving
                  ? '儲存中...'
                  : '確認登記'
              }}
            </button>
          </footer>
        </form>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.attendance-page {
  min-height: 100vh;
  padding: 24px 16px 60px;
  background: #f6f6f6;
  color: #222222;
}

.container {
  width: 100%;
  max-width: 820px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 15px;
}

.back-link {
  display: block;
  margin-bottom: 12px;
  color: #777777;
  font-size: 10px;
  text-decoration: none;
}

.page-header > div > span {
  color: #999999;
  font-size: 8px;
  letter-spacing: 1px;
}

.page-header h1 {
  margin: 3px 0 0;
  font-size: 27px;
}

.page-header p {
  margin: 4px 0 0;
  color: #888888;
  font-size: 9px;
}

.create-button {
  min-height: 40px;
  padding: 0 14px;
  border: 0;
  background: #222222;
  border-radius: 10px;
  color: #ffffff;
}

/* ============================================================
   Rule
   ============================================================ */

.rule-card {
  margin-top: 16px;
  padding: 13px;
  background: #222222;
  border-radius: 14px;
  color: #ffffff;
}

.rule-card strong {
  font-size: 10px;
}

.rule-card p {
  margin: 5px 0 0;
  color: rgb(255 255 255 / 60%);
  font-size: 8px;
  line-height: 1.6;
}

/* ============================================================
   Messages
   ============================================================ */

.error-message,
.success-message {
  margin-top: 9px;
  padding: 10px;
  border-radius: 10px;
  font-size: 9px;
}

.error-message {
  background: #fff0f0;
  color: #c94343;
}

.success-message {
  background: #eef8ee;
  color: #4b8e50;
}

/* ============================================================
   Summary
   ============================================================ */

.summary-grid {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 7px;
  margin-top: 10px;
}

.summary-grid article {
  padding: 11px;
  background: #ffffff;
  border-radius: 12px;
}

.summary-grid span {
  color: #999999;
  font-size: 7px;
}

.summary-grid strong {
  display: block;
  margin-top: 4px;
  font-size: 18px;
}

/* ============================================================
   Packages
   ============================================================ */

.package-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 9px;
}

.package-card {
  display: grid;
  grid-template-columns:
    2fr
    1fr;
  gap: 10px;
  padding: 11px;
  background: #ffffff;
  border-radius: 12px;
}

.package-card > div:last-child {
  text-align: right;
}

.package-card span {
  display: block;
  color: #999999;
  font-size: 7px;
}

.package-card strong {
  display: block;
  margin-top: 3px;
  font-size: 10px;
}

.package-card small {
  display: block;
  margin-top: 3px;
  color: #888888;
  font-size: 7px;
}

/* ============================================================
   Filters
   ============================================================ */

.filters {
  display: grid;
  grid-template-columns:
    repeat(
      4,
      1fr
    );
  gap: 7px;
  margin-top: 14px;
  padding: 11px;
  background: #ffffff;
  border-radius: 13px;
}

.filters label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filters label span {
  color: #888888;
  font-size: 7px;
}

.filters select,
.filters input {
  min-height: 36px;
  padding: 0 8px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 8px;
  font-size: 8px;
}

.filters button {
  min-height: 35px;
  border: 0;
  background: #222222;
  border-radius: 8px;
  color: #ffffff;
  font-size: 8px;
}

.filters .secondary {
  background: #eeeeee;
  color: #555555;
}

/* ============================================================
   History
   ============================================================ */

.history-section {
  margin-top: 18px;
}

.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.section-header > div > span {
  color: #999999;
  font-size: 8px;
  letter-spacing: 1px;
}

.section-header h2 {
  margin: 3px 0 0;
  font-size: 16px;
}

.section-header > span {
  color: #888888;
  font-size: 8px;
}

.attendance-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 9px;
}

.empty-state {
  margin-top: 9px;
  padding: 28px;
  background: #ffffff;
  border-radius: 13px;
  color: #aaaaaa;
  font-size: 9px;
  text-align: center;
}

/* ============================================================
   Dialog
   ============================================================ */

.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgb(0 0 0 / 48%);
}

.dialog {
  width: 100%;
  max-width: 470px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  padding: 19px;
  background: #ffffff;
  border-radius: 19px;
}

.dialog > header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.dialog header span {
  color: #999999;
  font-size: 8px;
}

.dialog h2 {
  margin: 3px 0 0;
}

.dialog header button {
  width: 33px;
  height: 33px;
  border: 0;
  background: #eeeeee;
  border-radius: 50%;
}

.dialog > label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 12px;
}

.dialog label span {
  color: #777777;
  font-size: 8px;
}

.dialog select,
.dialog input,
.dialog textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 8px;
}

.dialog select,
.dialog input {
  min-height: 39px;
}

.package-preview {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 6px;
  margin-top: 9px;
}

.package-preview > div {
  padding: 9px;
  background: #f7f7f7;
  border-radius: 8px;
}

.package-preview span {
  display: block;
  color: #999999;
  font-size: 7px;
}

.package-preview strong {
  display: block;
  margin-top: 3px;
  font-size: 11px;
}

.dialog-rule {
  margin-top: 12px;
  padding: 10px;
  background: #fff5df;
  border-radius: 9px;
}

.dialog-rule strong {
  color: #856319;
  font-size: 9px;
}

.dialog-rule p {
  margin: 4px 0 0;
  color: #8d7541;
  font-size: 8px;
  line-height: 1.5;
}

.dialog footer {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 7px;
  margin-top: 15px;
}

.dialog footer button {
  min-height: 40px;
  border: 0;
  background: #eeeeee;
  border-radius: 9px;
}

.dialog footer .confirm {
  background: #222222;
  color: #ffffff;
}

button:disabled {
  opacity: 0.45;
}

@media (
  max-width: 600px
) {
  .attendance-page {
    padding: 18px 12px 45px;
  }

  .page-header {
    align-items: flex-start;
  }

  .filters {
    grid-template-columns:
      1fr
      1fr;
  }
}

@media (
  max-width: 420px
) {
  .summary-grid {
    grid-template-columns:
      repeat(
        3,
        1fr
      );
  }
}
</style>