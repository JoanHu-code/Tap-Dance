<script setup>
definePageMeta({
  middleware:
    'student-auth',
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

const student =
  ref(null)

const records =
  ref([])

const enrollments =
  ref([])

const availableSessions =
  ref([])

const filters =
  reactive({
    courseId: '',
    status: '',
    startDate: '',
    endDate: '',
  })

const showCreateDialog =
  ref(false)

const createForm =
  reactive({
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
  return value
    ? String(
        value
      ).slice(
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
  ).slice(
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
    MANUAL: '老師手動',
  }

  return (
    map[type] ||
    type
  )
}

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
    session.is_fixed_schedule
      ? '固定班'
      : '其他時段',
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
          '/api/student/attendance',
          {
            query: {
              courseId:
                filters.courseId ||
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

      student.value =
        response.student ||
        null

      records.value =
        response.records ||
        []

      enrollments.value =
        response.enrollments ||
        []

      availableSessions.value =
        response.availableSessions ||
        []
    } catch (error) {
      console.error(
        'Attendance 載入失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.message ||
        'Attendance 載入失敗'
    } finally {
      loading.value =
        false
    }
  }

// ============================================================
// Create
// ============================================================

const openCreateDialog =
  () => {
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

watch(
  () =>
    createForm.sessionId,
  (
    sessionId
  ) => {
    const session =
      availableSessions.value
        .find(
          (
            item
          ) =>
            String(
              item.id
            ) ===
            String(
              sessionId
            )
        )

    if (!session) {
      return
    }

    createForm.attendanceType =
      session.is_fixed_schedule
        ? 'NORMAL'
        : 'MAKEUP'
  }
)

const createAttendance =
  async () => {
    if (
      creating.value
    ) {
      return
    }

    if (
      !createForm.sessionId
    ) {
      errorMessage.value =
        '請選擇課堂'

      return
    }

    creating.value =
      true

    try {
      const response =
        await $fetch(
          '/api/student/attendance',
          {
            method:
              'POST',

            body: {
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
        response.message ||
        '紀錄建立成功'
      )

      await fetchAttendance()
    } catch (error) {
      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.message ||
        '建立失敗'
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

    if (
      record.status ===
      'CANCELLED'
    ) {
      return
    }

    const nextStatus =
      record.status ===
        'ATTENDED'
        ? 'LEAVE'
        : 'ATTENDED'

    if (
      !window.confirm(
        `確定要將「${getStatusLabel(record.status)}」改成「${getStatusLabel(nextStatus)}」嗎？`
      )
    ) {
      return
    }

    actionLoadingId.value =
      record.id

    try {
      await $fetch(
        `/api/student/attendance/${record.id}`,
        {
          method:
            'PATCH',

          body: {
            status:
              nextStatus,

            note:
              record.note ||
              null,
          },
        }
      )

      showSuccess(
        '紀錄更新成功'
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
// Cancel / Restore
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
        `確定要${label}這筆紀錄嗎？`
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
        `/api/student/attendance/${record.id}/actions`,
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
        `紀錄已${label}`
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
            to="/student"
            class="back-link"
          >
            ← 我的課程
          </NuxtLink>

          <span>
            Attendance
          </span>

          <h1>
            上課紀錄
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
           Filters
           ==================================================== -->

      <section class="filter-card">
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
              enrollment in enrollments
            "
            :key="
              enrollment.id
            "
            :value="
              enrollment.course_id
            "
          >
            {{
              enrollment.course_name
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

        <button
          type="button"
          @click="
            fetchAttendance
          "
        >
          搜尋
        </button>
      </section>

      <!-- ====================================================
           Records
           ==================================================== -->

      <section class="records">
        <div
          v-if="
            loading
          "
          class="empty"
        >
          載入中...
        </div>

        <article
          v-for="
            record in records
          "
          v-else
          :key="
            record.id
          "
          class="record-card"
        >
          <div class="record-header">
            <div>
              <span>
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

              <h2>
                {{ record.course_name }}
              </h2>

              <p>
                {{
                  getTypeLabel(
                    record.attendance_type
                  )
                }}
                ・第
                {{
                  record.package_cycle_no ||
                  '-'
                }}
                期
              </p>
            </div>

            <strong class="status">
              {{
                getStatusLabel(
                  record.status
                )
              }}
            </strong>
          </div>

          <p
            v-if="
              record.note
            "
            class="note"
          >
            {{ record.note }}
          </p>

          <div class="actions">
            <button
              v-if="
                record.status ===
                  'ATTENDED' ||
                record.status ===
                  'LEAVE'
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
              改成
              {{
                record.status ===
                  'ATTENDED'
                  ? '請假'
                  : '已上課'
              }}
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
              恢復紀錄
            </button>
          </div>
        </article>

        <div
          v-if="
            !loading &&
            !records.length
          "
          class="empty"
        >
          尚未有符合條件的紀錄。
        </div>
      </section>
    </div>

    <!-- ======================================================
         Create
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
            新增上課紀錄
          </h2>

          <label>
            課堂

            <select
              v-model="
                createForm.sessionId
              "
              required
            >
              <option value="">
                請選擇
              </option>

              <option
                v-for="
                  session in availableSessions
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
            </select>
          </label>

          <label>
            備註

            <textarea
              v-model="
                createForm.note
              "
              rows="3"
              maxlength="1000"
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
                  ? '儲存中...'
                  : '儲存'
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
  padding: 20px 14px 50px;
  background: #f7f7f7;
  color: #222222;
}

.container {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.back-link {
  display: block;
  margin-bottom: 13px;
  color: #777777;
  font-size: 10px;
  text-decoration: none;
}

.page-header span {
  color: #999999;
  font-size: 10px;
}

.page-header h1 {
  margin: 4px 0 0;
  font-size: 24px;
}

.page-header p {
  margin: 4px 0 0;
  color: #777777;
  font-size: 11px;
}

.primary-button {
  min-height: 39px;
  padding: 0 13px;
  border: 0;
  background: #222222;
  border-radius: 12px;
  color: #ffffff;
  font-size: 11px;
}

.filter-card {
  display: grid;
  grid-template-columns:
    1fr 1fr;
  gap: 8px;
  margin-top: 17px;
  padding: 14px;
  background: #ffffff;
  border-radius: 18px;
}

.filter-card select,
.filter-card input,
.filter-card button {
  min-height: 38px;
  padding: 0 9px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 10px;
  font-size: 10px;
}

.filter-card button {
  grid-column: 1 / -1;
  background: #222222;
  color: #ffffff;
}

.records {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 13px;
}

.record-card {
  padding: 16px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 18px;
}

.record-header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.record-header span {
  color: #999999;
  font-size: 10px;
}

.record-header h2 {
  margin: 4px 0 0;
  font-size: 16px;
}

.record-header p {
  margin: 5px 0 0;
  color: #888888;
  font-size: 10px;
}

.status {
  height: fit-content;
  padding: 6px 9px;
  background: #f3f3f3;
  border-radius: 999px;
  font-size: 10px;
}

.note {
  margin: 11px 0 0;
  padding: 10px;
  background: #f7f7f7;
  border-radius: 10px;
  color: #777777;
  font-size: 10px;
}

.actions {
  display: flex;
  gap: 7px;
  margin-top: 12px;
}

.actions button {
  min-height: 34px;
  padding: 0 10px;
  border: 0;
  background: #eeeeee;
  border-radius: 9px;
  font-size: 10px;
}

.actions .danger {
  color: #c94343;
}

.actions .restore {
  background: #222222;
  color: #ffffff;
}

.empty {
  padding: 30px;
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

.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 17px;
  background: rgb(0 0 0 / 45%);
}

.dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 400px;
  padding: 21px;
  background: #ffffff;
  border-radius: 20px;
}

.dialog h2 {
  margin: 0;
}

.dialog label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 10px;
}

.dialog select,
.dialog textarea {
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid #dddddd;
  border-radius: 10px;
}

.dialog-actions {
  display: grid;
  grid-template-columns:
    1fr 1fr;
  gap: 8px;
  margin-top: 7px;
}

.dialog-actions button {
  min-height: 40px;
  border: 0;
  border-radius: 10px;
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
  padding: 10px 17px;
  background: #222222;
  border-radius: 999px;
  color: #ffffff;
  font-size: 10px;
  transform:
    translateX(-50%);
}

@media (
  max-width: 420px
) {
  .page-header {
    align-items: flex-start;
  }

  .filter-card {
    grid-template-columns:
      1fr;
  }

  .filter-card button {
    grid-column: auto;
  }
}
</style>