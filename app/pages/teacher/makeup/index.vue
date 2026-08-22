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

const actionLoadingId =
  ref(null)

const errorMessage =
  ref('')

const successMessage =
  ref('')

const makeups =
  ref([])

const students =
  ref([])

const courses =
  ref([])

const leaves =
  ref([])

const sessions =
  ref([])

const summary =
  ref({
    total: 0,
    active: 0,
    cancelled: 0,
  })

const filters =
  reactive({
    studentId: '',
    courseId: '',
    status: '',
  })

const showCreateDialog =
  ref(false)

let toastTimer =
  null

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
// Fetch
// ============================================================

const fetchMakeups =
  async () => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/teacher/makeups',
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
            },
          }
        )

      makeups.value =
        response.makeups ||
        []

      students.value =
        response.students ||
        []

      courses.value =
        response.courses ||
        []

      leaves.value =
        response.leaves ||
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
        }
    } catch (error) {
      console.error(
        'Makeup 載入失敗：',
        error
      )

      errorMessage.value =
        getErrorMessage(
          error,
          '補課資料載入失敗'
        )
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
    filters.studentId =
      ''

    filters.courseId =
      ''

    filters.status =
      ''

    await fetchMakeups()
  }

// ============================================================
// Create
// ============================================================

const openCreateDialog =
  () => {
    errorMessage.value =
      ''

    showCreateDialog.value =
      true
  }

const submitMakeup =
  async (
    payload
  ) => {
    if (
      creating.value
    ) {
      return
    }

    creating.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/teacher/makeups',
          {
            method:
              'POST',

            body: {
              studentId:
                payload.studentId,

              sourceLeaveAttendanceId:
                payload
                  .sourceLeaveAttendanceId,

              makeupSessionId:
                payload
                  .makeupSessionId,

              note:
                payload.note,
            },
          }
        )

      showCreateDialog.value =
        false

      showSuccess(
        response.message ||
        '補課建立成功'
      )

      await fetchMakeups()
    } catch (error) {
      errorMessage.value =
        getErrorMessage(
          error,
          '補課建立失敗'
        )
    } finally {
      creating.value =
        false
    }
  }

// ============================================================
// Update Note
// ============================================================

const editMakeupNote =
  async (
    makeup
  ) => {
    if (
      actionLoadingId.value
    ) {
      return
    }

    const note =
      window.prompt(
        '補課備註：',
        makeup.note ||
        ''
      )

    if (
      note === null
    ) {
      return
    }

    actionLoadingId.value =
      makeup.id

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          `/api/makeups/${makeup.id}`,
          {
            method:
              'PATCH',

            body: {
              action:
                'UPDATE_NOTE',

              note:
                note.trim() ||
                null,
            },
          }
        )

      showSuccess(
        response.message ||
        '補課備註已更新'
      )

      await fetchMakeups()
    } catch (error) {
      errorMessage.value =
        getErrorMessage(
          error,
          '補課備註修改失敗'
        )
    } finally {
      actionLoadingId.value =
        null
    }
  }

// ============================================================
// Cancel
// ============================================================

const cancelMakeup =
  async (
    makeup
  ) => {
    if (
      actionLoadingId.value
    ) {
      return
    }

    if (
      !window.confirm(
        `確定要取消 ${makeup.student_name || ''} 的這筆 ${makeup.course_name} 補課嗎？`
      )
    ) {
      return
    }

    const reason =
      window.prompt(
        '取消原因，可留空：',
        ''
      )

    if (
      reason === null
    ) {
      return
    }

    actionLoadingId.value =
      makeup.id

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          `/api/makeups/${makeup.id}`,
          {
            method:
              'PATCH',

            body: {
              action:
                'CANCEL',

              reason:
                reason.trim() ||
                null,
            },
          }
        )

      showSuccess(
        response.message ||
        '補課已取消'
      )

      await fetchMakeups()
    } catch (error) {
      errorMessage.value =
        getErrorMessage(
          error,
          '補課取消失敗'
        )
    } finally {
      actionLoadingId.value =
        null
    }
  }

// ============================================================
// Restore
// ============================================================

const restoreMakeup =
  async (
    makeup
  ) => {
    if (
      actionLoadingId.value
    ) {
      return
    }

    if (
      !window.confirm(
        `確定恢復這筆 ${makeup.course_name} 補課嗎？恢復後會重新扣回一堂。`
      )
    ) {
      return
    }

    const reason =
      window.prompt(
        '恢復原因，可留空：',
        ''
      )

    if (
      reason === null
    ) {
      return
    }

    actionLoadingId.value =
      makeup.id

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          `/api/makeups/${makeup.id}`,
          {
            method:
              'PATCH',

            body: {
              action:
                'RESTORE',

              reason:
                reason.trim() ||
                null,
            },
          }
        )

      showSuccess(
        response.message ||
        '補課已恢復'
      )

      await fetchMakeups()
    } catch (error) {
      errorMessage.value =
        getErrorMessage(
          error,
          '補課恢復失敗'
        )
    } finally {
      actionLoadingId.value =
        null
    }
  }

// ============================================================
// Lifecycle
// ============================================================

onMounted(
  async () => {
    await fetchMakeups()
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
  <main class="makeup-page">
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
            Makeup
          </span>

          <h1>
            補課管理
          </h1>

          <p>
            安排、取消、恢復學生補課並同步管理堂數。
          </p>
        </div>

        <button
          type="button"
          class="primary-button"
          @click="
            openCreateDialog
          "
        >
          ＋ 安排補課
        </button>
      </header>

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

      <section class="summary-grid">
        <article>
          <span>
            全部補課
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
            已取消
          </span>

          <strong>
            {{ summary.cancelled }}
          </strong>
        </article>
      </section>

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
            {{ student.name }}
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
            {{ course.name }}
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
              fetchMakeups
            "
          >
            搜尋
          </button>
        </div>
      </section>

      <section class="record-section">
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
            makeups.length
          "
          class="makeup-list"
        >
          <MakeupCard
            v-for="
              makeup in makeups
            "
            :key="
              makeup.id
            "
            :makeup="
              makeup
            "
            :show-student="
              true
            "
            :editable="
              true
            "
            :loading="
              String(
                actionLoadingId ||
                ''
              ) ===
                String(
                  makeup.id
                )
            "
            @edit-note="
              editMakeupNote
            "
            @cancel="
              cancelMakeup
            "
            @restore="
              restoreMakeup
            "
          />
        </div>

        <div
          v-else
          class="empty-state"
        >
          沒有符合條件的補課紀錄。
        </div>
      </section>
    </div>

    <MakeupCreateDialog
      v-model="
        showCreateDialog
      "
      :teacher-mode="
        true
      "
      :students="
        students
      "
      :leaves="
        leaves
      "
      :sessions="
        sessions
      "
      :loading="
        creating
      "
      @submit="
        submitMakeup
      "
    />

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
.makeup-page {
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

.primary-button {
  min-height: 42px;
  padding: 0 15px;
  border: 0;
  background: #222222;
  border-radius: 12px;
  color: #ffffff;
  font-size: 11px;
}

.summary-grid {
  display: grid;
  grid-template-columns:
    repeat(
      3,
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

.filter-card {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 8px;
  margin-top: 14px;
  padding: 15px;
  background: #ffffff;
  border-radius: 18px;
}

.filter-card select {
  min-height: 39px;
  padding: 0 9px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 9px;
  font-size: 10px;
}

.filter-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}

.filter-actions button {
  min-height: 35px;
  padding: 0 12px;
  border: 0;
  background: #eeeeee;
  border-radius: 9px;
}

.search-button {
  background: #222222 !important;
  color: #ffffff;
}

.record-section {
  margin-top: 15px;
}

.makeup-list {
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

.empty-state {
  padding: 35px;
  background: #ffffff;
  border-radius: 18px;
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

.toast {
  position: fixed;
  bottom: 25px;
  left: 50%;
  z-index: 1300;
  padding: 10px 18px;
  background: #222222;
  border-radius: 999px;
  color: #ffffff;
  font-size: 10px;
  transform: translateX(-50%);
}

@media (
  max-width: 760px
) {
  .makeup-list {
    grid-template-columns:
      1fr;
  }

  .filter-card {
    grid-template-columns:
      1fr;
  }
}

@media (
  max-width: 520px
) {
  .makeup-page {
    padding: 18px 13px 45px;
  }

  .page-header {
    align-items: flex-start;
  }
}
</style>