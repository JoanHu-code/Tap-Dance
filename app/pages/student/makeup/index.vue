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

const makeups =
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
    availableLeaves: 0,
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
          '/api/student/makeups'
        )

      student.value =
        response.student ||
        null

      makeups.value =
        response.makeups ||
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
          availableLeaves: 0,
        }
    } catch (error) {
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
// Create
// ============================================================

const openCreateDialog =
  () => {
    errorMessage.value =
      ''

    if (
      !leaves.value.length
    ) {
      errorMessage.value =
        '目前沒有可以安排補課的請假紀錄'

      return
    }

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
          '/api/student/makeups',
          {
            method:
              'POST',

            body: {
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
        '補課安排成功'
      )

      await fetchMakeups()
    } catch (error) {
      errorMessage.value =
        getErrorMessage(
          error,
          '補課安排失敗'
        )
    } finally {
      creating.value =
        false
    }
  }

// ============================================================
// Note
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
        '備註已更新'
      )

      await fetchMakeups()
    } catch (error) {
      errorMessage.value =
        getErrorMessage(
          error,
          '備註修改失敗'
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
        `確定取消 ${makeup.course_name} 的這筆補課嗎？取消後會把這一堂扣除。`
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
        `確定恢復 ${makeup.course_name} 的這筆補課嗎？恢復後會重新扣回一堂。`
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
  <main class="student-makeup-page">
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
            Makeup
          </span>

          <h1>
            我的補課
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
          :disabled="
            loading
          "
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
            補課紀錄
          </span>

          <strong>
            {{
              summary.total
            }}
          </strong>
        </article>

        <article>
          <span>
            有效補課
          </span>

          <strong>
            {{
              summary.active
            }}
          </strong>
        </article>

        <article>
          <span>
            待補請假
          </span>

          <strong>
            {{
              summary.availableLeaves
            }}
          </strong>
        </article>
      </section>

      <!-- ====================================================
           Available Leave
           ==================================================== -->

      <section
        v-if="
          leaves.length
        "
        class="available-section"
      >
        <div class="section-title">
          <span>
            Available
          </span>

          <h2>
            可以補課的請假
          </h2>
        </div>

        <div class="leave-list">
          <article
            v-for="
              leave in leaves
            "
            :key="
              leave.attendance_id
            "
            class="leave-card"
          >
            <div>
              <strong>
                {{
                  leave.course_name
                }}
              </strong>

              <span>
                第
                {{
                  leave.package_cycle_no ||
                  '-'
                }}
                期
              </span>
            </div>

            <p>
              {{
                String(
                  leave.class_date
                ).slice(
                  0,
                  10
                )
              }}

              ・

              {{
                String(
                  leave.start_time ||
                  ''
                ).slice(
                  0,
                  5
                )
              }}
            </p>

            <small
              v-if="
                leave.schedule_name
              "
            >
              {{
                leave.schedule_name
              }}
            </small>
          </article>
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
            補課紀錄
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
          尚未有補課紀錄。
        </div>
      </section>
    </div>

    <MakeupCreateDialog
      v-model="
        showCreateDialog
      "
      :teacher-mode="
        false
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
.student-makeup-page {
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

.page-header > div > span,
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

.primary-button:disabled {
  opacity: 0.5;
}

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

.available-section,
.history-section {
  margin-top: 18px;
}

.section-title h2 {
  margin: 3px 0 9px;
  font-size: 16px;
}

.leave-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.leave-card {
  flex: 0 0 190px;
  padding: 13px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 14px;
}

.leave-card > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.leave-card strong {
  font-size: 11px;
}

.leave-card span {
  color: #999999;
  font-size: 8px;
}

.leave-card p {
  margin: 7px 0 0;
  color: #666666;
  font-size: 9px;
}

.leave-card small {
  display: block;
  margin-top: 4px;
  color: #999999;
  font-size: 8px;
}

.makeup-list {
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
  z-index: 1300;
  padding: 10px 17px;
  background: #222222;
  border-radius: 999px;
  color: #ffffff;
  font-size: 10px;
  transform: translateX(-50%);
}
</style>