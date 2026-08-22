<script setup>
definePageMeta({
  middleware:
    'student-auth',
})

const loading =
  ref(true)

const creating =
  ref(false)

const errorMessage =
  ref('')

const successMessage =
  ref('')

const student =
  ref(null)

const batches =
  ref([])

const enrollments =
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
    courseId: '',
    sessionIds: [],
    reason: '',
  })

let toastTimer =
  null

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

const fetchLeaves =
  async () => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/student/leaves',
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

      batches.value =
        response.batches ||
        []

      enrollments.value =
        response.enrollments ||
        []

      sessions.value =
        response.sessions ||
        []

      summary.value =
        response.summary ||
        summary.value
    } catch (error) {
      console.error(
        '學生 Leave 載入失敗：',
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

    await fetchLeaves()
  }

// ============================================================
// Create
// ============================================================

const openCreateDialog =
  () => {
    createForm.courseId =
      ''

    createForm.sessionIds =
      []

    createForm.reason =
      ''

    showCreateDialog.value =
      true
  }

watch(
  () =>
    createForm.courseId,
  () => {
    createForm.sessionIds =
      []
  }
)

// ============================================================
// Submit
// ============================================================

const submitLeave =
  async () => {
    if (
      creating.value
    ) {
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
          '/api/student/leaves/batch',
          {
            method:
              'POST',

            body: {
              // ===============================================
              // 故意沒有 studentId
              // ===============================================

              sessionIds:
                createForm.sessionIds,

              reason:
                createForm.reason ||
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
        '學生請假失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '請假失敗'
    } finally {
      creating.value =
        false
    }
  }

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
  <main class="student-leave-page">
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
            ← 我的課程
          </NuxtLink>

          <span>
            Leave
          </span>

          <h1>
            請假
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
          ＋ 我要請假
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
          <span>
            請假批次
          </span>

          <strong>
            {{ summary.total }}
          </strong>
        </article>

        <article>
          <span>
            有效
          </span>

          <strong>
            {{ summary.active }}
          </strong>
        </article>

        <article>
          <span>
            請假堂數
          </span>

          <strong>
            {{ summary.totalSessions }}
          </strong>
        </article>
      </section>

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
              enrollment in
                enrollments
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
            重設
          </button>

          <button
            type="button"
            class="search-button"
            @click="
              fetchLeaves
            "
          >
            查詢
          </button>
        </div>
      </section>

      <!-- ====================================================
           History
           ==================================================== -->

      <section class="history-section">
        <div class="section-title">
          <span>
            History
          </span>

          <h2>
            請假紀錄
          </h2>
        </div>

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
          />
        </div>

        <div
          v-else
          class="empty-state"
        >
          尚未有請假紀錄。
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
            submitLeave
          "
        >
          <h2>
            我要請假
          </h2>

          <p class="description">
            可以只選一堂，也可以一次選擇同一門課的多個日期。
          </p>

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
                  enrollment in
                    enrollments
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
              maxlength="2000"
              rows="3"
              placeholder="可留空"
            />
          </label>

          <div class="selection-summary">
            <span>
              已選
            </span>

            <strong>
              {{
                createForm
                  .sessionIds
                  .length
              }}
              堂
            </strong>
          </div>

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
                !createForm.courseId ||
                !createForm.sessionIds.length
              "
            >
              {{
                creating
                  ? '送出中...'
                  : (
                      createForm.sessionIds.length > 1
                        ? `批次請假 ${createForm.sessionIds.length} 堂`
                        : '確認請假'
                    )
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
.student-leave-page {
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

/* ============================================================
   Header
   ============================================================ */

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

.page-header >
div >
span,
.section-title span {
  color: #999999;
  font-size: 9px;
  letter-spacing: 1px;
}

.page-header h1 {
  margin: 4px 0 0;
  font-size: 24px;
}

.page-header p {
  margin: 4px 0 0;
  color: #888888;
  font-size: 10px;
}

.primary-button {
  min-height: 39px;
  padding: 0 12px;
  border: 0;
  background: #222222;
  border-radius: 11px;
  color: #ffffff;
  font-size: 10px;
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
  gap: 8px;
  margin-top: 17px;
}

.summary-grid article {
  padding: 12px;
  background: #ffffff;
  border-radius: 14px;
}

.summary-grid span {
  color: #999999;
  font-size: 8px;
}

.summary-grid strong {
  display: block;
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
  gap: 7px;
  margin-top: 13px;
  padding: 13px;
  background: #ffffff;
  border-radius: 16px;
}

.filter-card select,
.filter-card input {
  min-height: 37px;
  padding: 0 8px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 9px;
  font-size: 9px;
}

.filter-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.filter-actions button {
  min-height: 33px;
  padding: 0 11px;
  border: 0;
  background: #eeeeee;
  border-radius: 8px;
  font-size: 9px;
}

.filter-actions .search-button {
  background: #222222;
  color: #ffffff;
}

/* ============================================================
   History
   ============================================================ */

.history-section {
  margin-top: 17px;
}

.section-title h2 {
  margin: 3px 0 9px;
  font-size: 16px;
}

.batch-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.empty-state {
  padding: 28px;
  background: #ffffff;
  border-radius: 16px;
  color: #aaaaaa;
  font-size: 10px;
  text-align: center;
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
  padding: 16px;
  background: rgb(0 0 0 / 45%);
}

.dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 430px;
  max-height:
    calc(
      100vh - 32px
    );
  overflow-y: auto;
  padding: 20px;
  background: #ffffff;
  border-radius: 20px;
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
  min-height: 40px;
  padding: 8px 9px;
  border: 1px solid #dddddd;
  border-radius: 10px;
}

.selection-summary {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: #f6f6f6;
  border-radius: 10px;
}

.selection-summary span {
  color: #888888;
  font-size: 10px;
}

.selection-summary strong {
  font-size: 11px;
}

.dialog-actions {
  display: grid;
  grid-template-columns:
    1fr 1fr;
  gap: 7px;
}

.dialog-actions button {
  min-height: 40px;
  border: 0;
  background: #eeeeee;
  border-radius: 10px;
  font-size: 10px;
}

.dialog-actions .confirm {
  background: #222222;
  color: #ffffff;
}

.dialog-actions button:disabled {
  opacity: 0.5;
}

/* ============================================================
   Messages
   ============================================================ */

.error-message {
  margin-top: 11px;
  padding: 10px;
  background: #fff0f0;
  border-radius: 10px;
  color: #c94343;
  font-size: 10px;
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
  transform: translateX(-50%);
}

@media (
  max-width: 420px
) {
  .filter-card {
    grid-template-columns:
      1fr;
  }

  .filter-actions {
    grid-column: auto;
  }
}
</style>