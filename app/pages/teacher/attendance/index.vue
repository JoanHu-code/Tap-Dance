<script setup>
definePageMeta({
  middleware:
    'teacher-auth',
})

const loading =
  ref(true)

const creating =
  ref(false)

const actionLoadingId =
  ref(null)

const errorMessage =
  ref('')

const successMessage =
  ref('')

const records =
  ref([])

const students =
  ref([])

const courses =
  ref([])

const sessions =
  ref([])

const summary =
  ref({
    total: 0,
    attended: 0,
    leave: 0,
    absent: 0,
    cancelled: 0,
  })

const filters =
  reactive({
    studentId: '',
    courseId: '',
    status: '',
    attendanceType: '',
    startDate: '',
    endDate: '',
    keyword: '',
  })

const showCreateDialog =
  ref(false)

const createForm =
  reactive({
    studentId: '',
    sessionId: '',
    status: 'ATTENDED',
    attendanceType: 'NORMAL',
    note: '',
  })

let toastTimer =
  null

// ============================================================
// Format
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

const getStatusLabel = (
  status
) => {
  const map = {
    ATTENDED: '已上課',
    LEAVE: '請假',
    ABSENT: '缺席',
    CANCELLED: '已取消',
  }

  return (
    map[status] ||
    status
  )
}

const getTypeLabel = (
  type
) => {
  const map = {
    NORMAL: '正常班',
    MAKEUP: '補課',
    MANUAL: '手動',
  }

  return (
    map[type] ||
    type
  )
}

// ============================================================
// Sessions
// ============================================================

const createSessions =
  computed(() => {
    if (
      !createForm.studentId
    ) {
      return sessions.value
    }

    return sessions.value
  })

const getSessionLabel = (
  session
) => {
  return [
    session.course_name,
    formatDate(
      session.class_date
    ),
    formatTime(
      session.start_time
    ),
    session.schedule_name ||
      '',
  ]
    .filter(
      Boolean
    )
    .join('｜')
}

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

const fetchAttendance =
  async () => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/teacher/attendance',
          {
            query: {
              studentId:
                filters.studentId ||
                undefined,

              courseId:
                filters.courseId ||
                undefined,

              status:
                filters.status ||
                undefined,

              attendanceType:
                filters.attendanceType ||
                undefined,

              startDate:
                filters.startDate ||
                undefined,

              endDate:
                filters.endDate ||
                undefined,

              keyword:
                filters.keyword ||
                undefined,
            },
          }
        )

      records.value =
        response.records ||
        []

      students.value =
        response.students ||
        []

      courses.value =
        response.courses ||
        []

      sessions.value =
        response.sessions ||
        []

      summary.value =
        response.summary ||
        summary.value
    } catch (error) {
      console.error(
        'Attendance 載入失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        'Attendance 載入失敗'
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
    filters.studentId =
      ''

    filters.courseId =
      ''

    filters.status =
      ''

    filters.attendanceType =
      ''

    filters.startDate =
      ''

    filters.endDate =
      ''

    filters.keyword =
      ''

    await fetchAttendance()
  }

// ============================================================
// Create
// ============================================================

const openCreateDialog =
  () => {
    createForm.studentId =
      ''

    createForm.sessionId =
      ''

    createForm.status =
      'ATTENDED'

    createForm.attendanceType =
      'NORMAL'

    createForm.note =
      ''

    showCreateDialog.value =
      true
  }

const createAttendance =
  async () => {
    if (
      creating.value
    ) {
      return
    }

    if (
      !createForm.studentId ||
      !createForm.sessionId
    ) {
      errorMessage.value =
        '請選擇學生與課堂'

      return
    }

    creating.value =
      true

    try {
      await $fetch(
        '/api/teacher/attendance',
        {
          method: 'POST',

          body: {
            studentId:
              createForm.studentId,

            sessionId:
              createForm.sessionId,

            status:
              createForm.status,

            attendanceType:
              createForm.attendanceType,

            note:
              createForm.note ||
              null,
          },
        }
      )

      showCreateDialog.value =
        false

      showSuccess(
        'Attendance 建立成功'
      )

      await fetchAttendance()
    } catch (error) {
      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.message ||
        'Attendance 建立失敗'
    } finally {
      creating.value =
        false
    }
  }

// ============================================================
// Update
// ============================================================

const updateRecord =
  async (
    record
  ) => {
    if (
      actionLoadingId.value
    ) {
      return
    }

    const newStatus =
      window.prompt(
        [
          '請輸入新的狀態：',
          '',
          'ATTENDED',
          'LEAVE',
          'ABSENT',
        ].join(
          '\n'
        ),
        record.status
      )

    if (!newStatus) {
      return
    }

    const note =
      window.prompt(
        '備註：',
        record.note ||
        ''
      )

    actionLoadingId.value =
      record.id

    try {
      await $fetch(
        `/api/teacher/attendance/${record.id}`,
        {
          method:
            'PATCH',

          body: {
            status:
              newStatus
                .trim()
                .toUpperCase(),

            note,
          },
        }
      )

      showSuccess(
        'Attendance 已更新'
      )

      await fetchAttendance()
    } catch (error) {
      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.message ||
        '修改失敗'
    } finally {
      actionLoadingId.value =
        null
    }
  }

// ============================================================
// Action
// ============================================================

const runAction =
  async (
    record,
    action
  ) => {
    if (
      actionLoadingId.value
    ) {
      return
    }

    const label =
      action ===
        'CANCEL'
        ? '取消'
        : '恢復'

    if (
      !window.confirm(
        `確定要${label}這筆 Attendance 嗎？`
      )
    ) {
      return
    }

    const reason =
      window.prompt(
        `${label}原因，可留空：`,
        ''
      )

    actionLoadingId.value =
      record.id

    try {
      await $fetch(
        `/api/teacher/attendance/${record.id}/actions`,
        {
          method:
            'POST',

          body: {
            action,

            reason:
              reason ||
              null,
          },
        }
      )

      showSuccess(
        `Attendance 已${label}`
      )

      await fetchAttendance()
    } catch (error) {
      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.message ||
        `${label}失敗`
    } finally {
      actionLoadingId.value =
        null
    }
  }

onMounted(
  async () => {
    await fetchAttendance()
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
  <main class="attendance-page">
    <div class="container">
      <header class="page-header">
        <div>
          <NuxtLink
            to="/teacher"
            class="back-link"
          >
            ← 老師首頁
          </NuxtLink>

          <span>
            Attendance
          </span>

          <h1>
            上課紀錄
          </h1>

          <p>
            管理學生的簽到、請假、缺席、取消與恢復。
          </p>
        </div>

        <button
          type="button"
          class="primary-button"
          @click="
            openCreateDialog
          "
        >
          ＋ 新增紀錄
        </button>
      </header>

      <div
        v-if="
          errorMessage
        "
        class="error-message"
      >
        {{ errorMessage }}
      </div>

      <!-- ====================================================
           Summary
           ==================================================== -->

      <section class="summary-grid">
        <article>
          <span>全部</span>
          <strong>{{ summary.total }}</strong>
        </article>

        <article>
          <span>已上課</span>
          <strong>{{ summary.attended }}</strong>
        </article>

        <article>
          <span>請假</span>
          <strong>{{ summary.leave }}</strong>
        </article>

        <article>
          <span>缺席</span>
          <strong>{{ summary.absent }}</strong>
        </article>

        <article>
          <span>取消</span>
          <strong>{{ summary.cancelled }}</strong>
        </article>
      </section>

      <!-- ====================================================
           Filters
           ==================================================== -->

      <section class="filter-panel">
        <div class="filter-grid">
          <label>
            <span>學生</span>

            <select
              v-model="
                filters.studentId
              "
            >
              <option value="">
                全部學生
              </option>

              <option
                v-for="
                  student in students
                "
                :key="
                  student.id
                "
                :value="
                  student.id
                "
              >
                {{ student.name }}
              </option>
            </select>
          </label>

          <label>
            <span>課程</span>

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
                {{ course.name }}
              </option>
            </select>
          </label>

          <label>
            <span>狀態</span>

            <select
              v-model="
                filters.status
              "
            >
              <option value="">
                全部
              </option>

              <option value="ATTENDED">
                已上課
              </option>

              <option value="LEAVE">
                請假
              </option>

              <option value="ABSENT">
                缺席
              </option>

              <option value="CANCELLED">
                已取消
              </option>
            </select>
          </label>

          <label>
            <span>類型</span>

            <select
              v-model="
                filters.attendanceType
              "
            >
              <option value="">
                全部
              </option>

              <option value="NORMAL">
                正常班
              </option>

              <option value="MAKEUP">
                補課
              </option>

              <option value="MANUAL">
                手動
              </option>
            </select>
          </label>

          <label>
            <span>開始日期</span>

            <input
              v-model="
                filters.startDate
              "
              type="date"
            >
          </label>

          <label>
            <span>結束日期</span>

            <input
              v-model="
                filters.endDate
              "
              type="date"
            >
          </label>
        </div>

        <label class="keyword-field">
          <span>搜尋</span>

          <input
            v-model="
              filters.keyword
            "
            type="text"
            placeholder="學生姓名、課程、備註"
            @keyup.enter="
              fetchAttendance
            "
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
              fetchAttendance
            "
          >
            搜尋
          </button>
        </div>
      </section>

      <!-- ====================================================
           Records
           ==================================================== -->

      <section class="records-panel">
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
            records.length
          "
          class="record-list"
        >
          <article
            v-for="
              record in records
            "
            :key="
              record.id
            "
            class="record-card"
          >
            <div class="record-main">
              <div>
                <span class="date">
                  {{
                    formatDate(
                      record.class_date
                    )
                  }}
                  {{
                    formatTime(
                      record.start_time
                    )
                  }}
                </span>

                <h3>
                  {{ record.student_name }}
                </h3>

                <p>
                  {{ record.course_name }}
                  ・
                  {{ getTypeLabel(record.attendance_type) }}
                  ・
                  第 {{ record.package_cycle_no || '-' }} 期
                </p>

                <small
                  v-if="
                    record.note
                  "
                >
                  {{ record.note }}
                </small>
              </div>

              <span
                class="status-pill"
                :class="
                  `status-${record.status.toLowerCase()}`
                "
              >
                {{
                  getStatusLabel(
                    record.status
                  )
                }}
              </span>
            </div>

            <div class="record-actions">
              <button
                v-if="
                  record.status !==
                  'CANCELLED'
                "
                type="button"
                :disabled="
                  actionLoadingId ===
                  record.id
                "
                @click="
                  updateRecord(
                    record
                  )
                "
              >
                修改
              </button>

              <button
                v-if="
                  record.status !==
                  'CANCELLED'
                "
                type="button"
                class="danger"
                :disabled="
                  actionLoadingId ===
                  record.id
                "
                @click="
                  runAction(
                    record,
                    'CANCEL'
                  )
                "
              >
                取消紀錄
              </button>

              <button
                v-else
                type="button"
                class="restore"
                :disabled="
                  actionLoadingId ===
                  record.id
                "
                @click="
                  runAction(
                    record,
                    'RESTORE'
                  )
                "
              >
                恢復
              </button>
            </div>
          </article>
        </div>

        <div
          v-else
          class="empty-state"
        >
          沒有符合條件的 Attendance。
        </div>
      </section>
    </div>

    <!-- ======================================================
         Create Dialog
         ====================================================== -->

    <Teleport to="body">
      <div
        v-if="
          showCreateDialog
        "
        class="dialog-mask"
        @click.self="
          showCreateDialog =
            false
        "
      >
        <form
          class="dialog"
          @submit.prevent="
            createAttendance
          "
        >
          <h2>
            新增 Attendance
          </h2>

          <label>
            學生

            <select
              v-model="
                createForm.studentId
              "
              required
            >
              <option value="">
                請選擇學生
              </option>

              <option
                v-for="
                  student in students
                "
                :key="
                  student.id
                "
                :value="
                  student.id
                "
              >
                {{ student.name }}
              </option>
            </select>
          </label>

          <label>
            課堂

            <select
              v-model="
                createForm.sessionId
              "
              required
            >
              <option value="">
                請選擇課堂
              </option>

              <option
                v-for="
                  session in createSessions
                "
                :key="
                  session.id
                "
                :value="
                  session.id
                "
              >
                {{
                  getSessionLabel(
                    session
                  )
                }}
              </option>
            </select>
          </label>

          <label>
            狀態

            <select
              v-model="
                createForm.status
              "
            >
              <option value="ATTENDED">
                已上課
              </option>

              <option value="LEAVE">
                請假
              </option>

              <option value="ABSENT">
                缺席
              </option>
            </select>
          </label>

          <label>
            類型

            <select
              v-model="
                createForm.attendanceType
              "
            >
              <option value="NORMAL">
                正常班
              </option>

              <option value="MAKEUP">
                補課
              </option>

              <option value="MANUAL">
                手動
              </option>
            </select>
          </label>

          <label>
            備註

            <textarea
              v-model="
                createForm.note
              "
              maxlength="1000"
              rows="3"
            />
          </label>

          <div class="dialog-actions">
            <button
              type="button"
              @click="
                showCreateDialog =
                  false
              "
            >
              取消
            </button>

            <button
              type="submit"
              class="confirm"
              :disabled="
                creating
              "
            >
              {{
                creating
                  ? '建立中...'
                  : '建立'
              }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>

    <Transition name="toast">
      <div
        v-if="
          successMessage
        "
        class="toast"
      >
        {{ successMessage }}
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.attendance-page {
  min-height: 100vh;
  padding: 28px 20px 60px;
  background: #f6f6f6;
  color: #222222;
}

.container {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
}

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
  margin: 4px 0 0;
}

.page-header p {
  margin: 6px 0 0;
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
  padding: 0 16px;
  border-radius: 13px;
}

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

.filter-panel,
.records-panel {
  margin-top: 15px;
  padding: 18px;
  background: #ffffff;
  border-radius: 20px;
}

.filter-grid {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 10px;
}

.filter-panel label,
.dialog label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 10px;
}

.filter-panel select,
.filter-panel input,
.dialog select,
.dialog textarea {
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid #dddddd;
  border-radius: 10px;
  background: #ffffff;
}

.keyword-field {
  margin-top: 10px;
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.filter-actions button {
  min-height: 37px;
  padding: 0 14px;
  border: 0;
  background: #eeeeee;
  border-radius: 10px;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.record-card {
  padding: 15px;
  border: 1px solid #eeeeee;
  border-radius: 15px;
}

.record-main {
  display: flex;
  justify-content: space-between;
  gap: 15px;
}

.record-main h3 {
  margin: 4px 0 0;
}

.record-main p {
  margin: 4px 0 0;
  color: #777777;
  font-size: 11px;
}

.record-main small {
  display: block;
  margin-top: 7px;
  color: #999999;
}

.date {
  color: #999999;
  font-size: 10px;
}

.status-pill {
  height: fit-content;
  padding: 6px 9px;
  background: #f3f3f3;
  border-radius: 999px;
  font-size: 10px;
}

.record-actions {
  display: flex;
  gap: 7px;
  margin-top: 13px;
}

.record-actions button {
  min-height: 33px;
  padding: 0 11px;
  border: 0;
  background: #eeeeee;
  border-radius: 9px;
  font-size: 10px;
}

.record-actions .danger {
  color: #c94343;
}

.record-actions .restore {
  background: #222222;
  color: #ffffff;
}

.empty-state {
  padding: 35px;
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
  display: flex;
  flex-direction: column;
  gap: 13px;
  width: 100%;
  max-width: 440px;
  padding: 22px;
  background: #ffffff;
  border-radius: 21px;
}

.dialog h2 {
  margin: 0;
}

.dialog-actions {
  display: grid;
  grid-template-columns:
    1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}

.dialog-actions button {
  min-height: 41px;
  border: 0;
  border-radius: 11px;
}

.dialog-actions .confirm {
  background: #222222;
  color: #ffffff;
}

.toast {
  position: fixed;
  bottom: 25px;
  left: 50%;
  z-index: 1100;
  padding: 10px 18px;
  background: #222222;
  border-radius: 999px;
  color: #ffffff;
  font-size: 11px;
  transform:
    translateX(-50%);
}

@media (
  max-width: 700px
) {
  .summary-grid {
    grid-template-columns:
      repeat(
        2,
        1fr
      );
  }

  .filter-grid {
    grid-template-columns:
      1fr;
  }
}
</style>