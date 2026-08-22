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

const creating =
  ref(false)

const errorMessage =
  ref('')

const successMessage =
  ref('')

const batches =
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
    active: 0,
    cancelled: 0,
    totalSessions: 0,
  })

// ============================================================
// Filters
// ============================================================

const filters =
  reactive({
    studentId: '',
    courseId: '',
    status: '',
    startDate: '',
    endDate: '',
  })

// ============================================================
// Create
// ============================================================

const showCreateDialog =
  ref(false)

const createForm =
  reactive({
    studentId: '',
    courseId: '',
    sessionIds: [],
    reason: '',
  })

// ============================================================
// Action Dialog
// ============================================================

const showActionDialog =
  ref(false)

const selectedActionBatch =
  ref(null)

const selectedAction =
  ref('')

// ============================================================
// Toast
// ============================================================

let toastTimer =
  null

const showSuccess =
  (
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
// Leave Actions
// ============================================================

const {
  actionLoading,
  actionLoadingBatchId,
  actionError,
  updateReason,
  cancelBatch,
  restoreBatch,
  clearActionError,
} =
  useLeaveBatchActions({
    role:
      'TEACHER',
  })

// ============================================================
// Create Course
// ============================================================

const availableCreateCourses =
  computed(() => {
    return courses.value
  })

// ============================================================
// Create Sessions
// ============================================================

const createSessions =
  computed(() => {
    if (
      !createForm.courseId
    ) {
      return []
    }

    return sessions.value
      .filter(
        (
          session
        ) => {
          return (
            String(
              session.course_id
            ) ===
            String(
              createForm.courseId
            )
          )
        }
      )
  })

// ============================================================
// Fetch
// ============================================================

const fetchLeaves =
  async () => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/teacher/leaves',
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

              startDate:
                filters.startDate ||
                undefined,

              endDate:
                filters.endDate ||
                undefined,
            },
          }
        )

      batches.value =
        response.batches ||
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
        {
          total: 0,
          active: 0,
          cancelled: 0,
          totalSessions: 0,
        }
    } catch (error) {
      console.error(
        'Leave 載入失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '請假資料載入失敗'
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

    filters.startDate =
      ''

    filters.endDate =
      ''

    await fetchLeaves()
  }

// ============================================================
// Open Create
// ============================================================

const openCreateDialog =
  () => {
    createForm.studentId =
      ''

    createForm.courseId =
      ''

    createForm.sessionIds =
      []

    createForm.reason =
      ''

    showCreateDialog.value =
      true
  }

// ============================================================
// Course Change
// ============================================================

watch(
  () =>
    createForm.courseId,
  () => {
    createForm.sessionIds =
      []
  }
)

// ============================================================
// Create Leave
// ============================================================

const createLeave =
  async () => {
    if (
      creating.value
    ) {
      return
    }

    if (
      !createForm.studentId
    ) {
      errorMessage.value =
        '請選擇學生'

      return
    }

    if (
      !createForm.courseId
    ) {
      errorMessage.value =
        '請選擇課程'

      return
    }

    if (
      !createForm.sessionIds
        .length
    ) {
      errorMessage.value =
        '請至少選擇一堂課'

      return
    }

    creating.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/teacher/leaves/batch',
          {
            method:
              'POST',

            body: {
              studentId:
                createForm.studentId,

              sessionIds:
                createForm.sessionIds,

              reason:
                createForm.reason
                  .trim() ||
                null,
            },
          }
        )

      showCreateDialog.value =
        false

      showSuccess(
        response.message ||
        '請假完成'
      )

      await fetchLeaves()
    } catch (error) {
      console.error(
        '建立請假失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '請假建立失敗'
    } finally {
      creating.value =
        false
    }
  }

// ============================================================
// Open Action Dialog
// ============================================================

const openActionDialog =
  (
    batch,
    action
  ) => {
    clearActionError()

    selectedActionBatch.value =
      batch

    selectedAction.value =
      action

    showActionDialog.value =
      true
  }

// ============================================================
// Action Submit
// ============================================================

const submitAction =
  async (
    payload
  ) => {
    errorMessage.value =
      ''

    try {
      let response =
        null

      if (
        payload.action ===
        'UPDATE_REASON'
      ) {
        response =
          await updateReason(
            payload.batch.id,
            payload.reason
          )
      } else if (
        payload.action ===
        'CANCEL'
      ) {
        response =
          await cancelBatch(
            payload.batch.id,
            payload.reason
          )
      } else if (
        payload.action ===
        'RESTORE'
      ) {
        response =
          await restoreBatch(
            payload.batch.id,
            payload.reason
          )
      }

      showActionDialog.value =
        false

      selectedActionBatch.value =
        null

      selectedAction.value =
        ''

      showSuccess(
        response?.message ||
        '請假紀錄已更新'
      )

      await fetchLeaves()
    } catch (error) {
      errorMessage.value =
        actionError.value ||
        error?.data
          ?.statusMessage ||
        error?.message ||
        '請假操作失敗'
    }
  }

// ============================================================
// Mounted
// ============================================================

onMounted(
  async () => {
    await fetchLeaves()
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
  <main class="leave-page">
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
            Leave
          </span>

          <h1>
            請假管理
          </h1>

          <p>
            管理學生單次、批次請假，以及取消與恢復。
          </p>
        </div>

        <button
          type="button"
          class="primary-button"
          @click="
            openCreateDialog
          "
        >
          ＋ 建立請假
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
            請假批次
          </span>

          <strong>
            {{
              summary.total
            }}
          </strong>
        </article>

        <article>
          <span>
            有效
          </span>

          <strong>
            {{
              summary.active
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

        <article>
          <span>
            請假堂數
          </span>

          <strong>
            {{
              summary.totalSessions
            }}
          </strong>
        </article>
      </section>

      <!-- ====================================================
           Filters
           ==================================================== -->

      <section class="filter-card">
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
            {{
              student.name
            }}
          </option>
        </select>

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

        <select
          v-model="
            filters.status
          "
        >
          <option value="">
            全部狀態
          </option>

          <option value="ACTIVE">
            有效
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
              fetchLeaves
            "
          >
            搜尋
          </button>
        </div>
      </section>

      <!-- ====================================================
           Batches
           ==================================================== -->

      <section class="batch-section">
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
            batches.length
          "
          class="batch-list"
        >
          <LeaveBatchCard
            v-for="
              batch in batches
            "
            :key="
              batch.id
            "
            :batch="
              batch
            "
            :show-student="
              true
            "
            :editable="
              true
            "
            :loading="
              actionLoading &&
              String(
                actionLoadingBatchId ||
                ''
              ) ===
                String(
                  batch.id
                )
            "
            @edit-reason="
              openActionDialog(
                $event,
                'UPDATE_REASON'
              )
            "
            @cancel="
              openActionDialog(
                $event,
                'CANCEL'
              )
            "
            @restore="
              openActionDialog(
                $event,
                'RESTORE'
              )
            "
          />
        </div>

        <div
          v-else
          class="empty-state"
        >
          沒有符合條件的請假紀錄。
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
            createLeave
          "
        >
          <h2>
            建立請假
          </h2>

          <p class="description">
            勾一堂是單次請假；同一門課勾多堂就是批次請假。
          </p>

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
                {{
                  student.name
                }}
              </option>
            </select>
          </label>

          <label>
            課程

            <select
              v-model="
                createForm.courseId
              "
              required
            >
              <option value="">
                請選擇課程
              </option>

              <option
                v-for="
                  course in
                    availableCreateCourses
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

          <LeaveSessionPicker
            v-model="
              createForm.sessionIds
            "
            :sessions="
              createSessions
            "
            :course-id="
              createForm.courseId
            "
            :disabled="
              creating
            "
          />

          <label>
            請假原因

            <textarea
              v-model="
                createForm.reason
              "
              rows="3"
              maxlength="2000"
              placeholder="可留空"
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
                creating ||
                !createForm.studentId ||
                !createForm.courseId ||
                !createForm.sessionIds
                  .length
              "
            >
              {{
                creating
                  ? '建立中...'
                  : (
                      createForm
                        .sessionIds
                        .length >
                        1
                        ? `批次請假 ${createForm.sessionIds.length} 堂`
                        : '確認請假'
                    )
              }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>

    <!-- ======================================================
         Action Dialog
         ====================================================== -->

    <LeaveBatchActionDialog
      v-model="
        showActionDialog
      "
      :batch="
        selectedActionBatch
      "
      :action="
        selectedAction
      "
      :loading="
        actionLoading
      "
      @submit="
        submitAction
      "
    />

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
.leave-page {
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

.primary-button {
  min-height: 42px;
  padding:
    0
    15px;
  border: 0;
  background: #222222;
  border-radius: 12px;
  color: #ffffff;
  font-size: 11px;
  cursor: pointer;
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
  gap: 9px;
  margin-top: 20px;
}

.summary-grid article {
  padding: 15px;
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
  cursor: pointer;
}

.search-button {
  background: #222222 !important;
  color: #ffffff;
}

/* ============================================================
   Batches
   ============================================================ */

.batch-section {
  margin-top: 15px;
}

.batch-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty-state {
  padding: 35px;
  background: #ffffff;
  border-radius: 18px;
  color: #aaaaaa;
  text-align: center;
}

/* ============================================================
   Error
   ============================================================ */

.error-message {
  margin-top: 12px;
  padding: 10px;
  background: #fff0f0;
  border-radius: 10px;
  color: #c94343;
  font-size: 10px;
}

/* ============================================================
   Create Dialog
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
  max-width: 560px;
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

.description {
  margin: 0;
  color: #888888;
  font-size: 10px;
  line-height: 1.6;
}

.dialog label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 10px;
}

.dialog select,
.dialog textarea {
  min-height: 41px;
  padding:
    8px
    10px;
  border: 1px solid #dddddd;
  border-radius: 10px;
}

.dialog-actions {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
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

.dialog-actions button:disabled {
  opacity: 0.5;
}

/* ============================================================
   Toast
   ============================================================ */

.toast {
  position: fixed;
  bottom: 25px;
  left: 50%;
  z-index: 1300;
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
      1fr
      1fr;
  }

  .filter-card {
    grid-template-columns:
      1fr
      1fr;
  }
}

@media (
  max-width: 520px
) {
  .leave-page {
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