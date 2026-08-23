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

const errorMessage =
  ref('')

const successMessage =
  ref('')

const student =
  ref(null)

const sourceLeaves =
  ref([])

const makeups =
  ref([])

const showCreate =
  ref(false)

// ============================================================
// Saving IDs
// ============================================================

const savingIds =
  ref(
    new Set()
  )

const isSaving = (
  id
) => {
  return savingIds.value.has(
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
// Form
// ============================================================

const form =
  reactive({
    sourceLeaveAttendanceId:
      '',

    makeupDate:
      getTaipeiToday(),

    note:
      '',
  })

// ============================================================
// Selected Leave
// ============================================================

const selectedLeave =
  computed(() => {
    return (
      sourceLeaves.value.find(
        (
          item
        ) => {
          return (
            String(
              item.attendance_id
            ) ===
            String(
              form
                .sourceLeaveAttendanceId
            )
          )
        }
      ) ||
      null
    )
  })

// ============================================================
// Available Leaves
// ============================================================

const availableLeaves =
  computed(() => {
    return sourceLeaves.value.filter(
      (
        item
      ) => {
        const used =
          Number(
            item.used_sessions ||
            0
          )

        const total =
          Number(
            item.total_sessions ||
            0
          )

        return (
          !item.has_active_makeup &&
          used < total
        )
      }
    )
  })

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
// Load
// ============================================================

const loadData =
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

      sourceLeaves.value =
        response.sourceLeaves ||
        []

      makeups.value =
        response.makeups ||
        []
    } catch (
      error
    ) {
      console.error(
        '補課資料載入失敗：',
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
// Open Create
// ============================================================

const openCreate =
  () => {
    form.sourceLeaveAttendanceId =
      availableLeaves.value[0]
        ?.attendance_id ||
      ''

    form.makeupDate =
      getTaipeiToday()

    form.note =
      ''

    showCreate.value =
      true
  }

// ============================================================
// Create
// ============================================================

const createMakeup =
  async () => {
    if (
      creating.value
    ) {
      return
    }

    if (
      !form.sourceLeaveAttendanceId
    ) {
      errorMessage.value =
        '請選擇原本的請假紀錄'

      return
    }

    if (
      !form.makeupDate
    ) {
      errorMessage.value =
        '請選擇補課日期'

      return
    }

    creating.value =
      true

    errorMessage.value =
      ''

    successMessage.value =
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
                form
                  .sourceLeaveAttendanceId,

              makeupDate:
                form.makeupDate,

              note:
                form.note.trim() ||
                null,
            },
          }
        )

      successMessage.value =
        response.message ||
        '補課已建立'

      showCreate.value =
        false

      await loadData()
    } catch (
      error
    ) {
      console.error(
        '建立補課失敗：',
        error
      )

      errorMessage.value =
        getErrorMessage(
          error,
          '建立補課失敗'
        )
    } finally {
      creating.value =
        false
    }
  }

// ============================================================
// Action
// ============================================================

const handleAction =
  async (
    payload
  ) => {
    const makeupId =
      String(
        payload.makeupId
      )

    if (
      isSaving(
        makeupId
      )
    ) {
      return
    }

    savingIds.value.add(
      makeupId
    )

    savingIds.value =
      new Set(
        savingIds.value
      )

    errorMessage.value =
      ''

    successMessage.value =
      ''

    try {
      const response =
        await $fetch(
          `/api/makeups/${makeupId}`,
          {
            method:
              'PATCH',

            body: {
              action:
                payload.action,

              note:
                payload.note,

              reason:
                payload.reason,
            },
          }
        )

      successMessage.value =
        response.message ||
        '補課資料已更新'

      await loadData()
    } catch (
      error
    ) {
      console.error(
        '補課異動失敗：',
        error
      )

      errorMessage.value =
        getErrorMessage(
          error,
          '補課資料更新失敗'
        )
    } finally {
      savingIds.value.delete(
        makeupId
      )

      savingIds.value =
        new Set(
          savingIds.value
        )
    }
  }

// ============================================================
// Lifecycle
// ============================================================

onMounted(
  async () => {
    await loadData()
  }
)
</script>

<template>
  <main class="makeup-page">
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
          class="create-button"
          :disabled="
            !availableLeaves.length
          "
          @click="
            openCreate
          "
        >
          ＋ 建立補課
        </button>
      </header>

      <!-- ====================================================
           Rule
           ==================================================== -->

      <section class="rule-card">
        <strong>
          補課實際出席才算 1 堂
        </strong>

        <p>
          原本請假不扣堂。建立補課後會產生一筆 MAKEUP + ATTENDED，因此方案增加 1 堂實際出席；若取消補課，這一堂會再扣回。
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
           Available Leaves
           ==================================================== -->

      <section class="section">
        <div class="section-header">
          <div>
            <span>
              Available Leave
            </span>

            <h2>
              可以補課的請假
            </h2>
          </div>

          <span>
            {{
              availableLeaves.length
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
          載入中...
        </div>

        <div
          v-else-if="
            availableLeaves.length
          "
          class="leave-list"
        >
          <article
            v-for="
              leave in
                availableLeaves
            "
            :key="
              leave.attendance_id
            "
          >
            <div>
              <span>
                {{
                  formatDate(
                    leave.class_date
                  )
                }}
              </span>

              <strong>
                {{
                  leave.course_name
                }}
              </strong>

              <small>
                {{
                  weekdayMap[
                    Number(
                      leave.weekday
                    )
                  ]
                }}
                ・
                {{
                  formatTime(
                    leave.start_time
                  )
                }}
              </small>
            </div>

            <div>
              <span>
                目前方案
              </span>

              <strong>
                {{
                  leave.used_sessions
                }}
                /
                {{
                  leave.total_sessions
                }}
              </strong>
            </div>
          </article>
        </div>

        <div
          v-else
          class="empty-state"
        >
          目前沒有可以建立補課的請假紀錄。
        </div>
      </section>

      <!-- ====================================================
           History
           ==================================================== -->

      <section class="section">
        <div class="section-header">
          <div>
            <span>
              History
            </span>

            <h2>
              補課紀錄
            </h2>
          </div>

          <span>
            {{
              makeups.length
            }}
            筆
          </span>
        </div>

        <div
          v-if="
            makeups.length
          "
          class="makeup-list"
        >
          <MakeupCard
            v-for="
              record in
                makeups
            "
            :key="
              record.id
            "
            :record="
              record
            "
            :saving="
              isSaving(
                record.id
              )
            "
            @action="
              handleAction
            "
          />
        </div>

        <div
          v-else-if="
            !loading
          "
          class="empty-state"
        >
          尚無補課紀錄。
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
          !creating &&
          (
            showCreate =
              false
          )
        "
      >
        <form
          class="dialog"
          @submit.prevent="
            createMakeup
          "
        >
          <header>
            <div>
              <span>
                New Makeup
              </span>

              <h2>
                建立補課
              </h2>
            </div>

            <button
              type="button"
              :disabled="
                creating
              "
              @click="
                showCreate =
                  false
              "
            >
              ×
            </button>
          </header>

          <!-- Leave -->

          <label>
            <span>
              要補哪一次請假
            </span>

            <select
              v-model="
                form
                  .sourceLeaveAttendanceId
              "
              required
              :disabled="
                creating
              "
            >
              <option
                v-for="
                  leave in
                    availableLeaves
                "
                :key="
                  leave.attendance_id
                "
                :value="
                  leave.attendance_id
                "
              >
                {{
                  leave.course_name
                }}
                ・
                {{
                  formatDate(
                    leave.class_date
                  )
                }}
              </option>
            </select>
          </label>

          <!-- Selected -->

          <section
            v-if="
              selectedLeave
            "
            class="leave-preview"
          >
            <span>
              原始請假
            </span>

            <strong>
              {{
                selectedLeave
                  .course_name
              }}
            </strong>

            <p>
              {{
                formatDate(
                  selectedLeave
                    .class_date
                )
              }}
              ・
              {{
                formatTime(
                  selectedLeave
                    .start_time
                )
              }}
            </p>

            <p>
              方案：
              {{
                selectedLeave
                  .used_sessions
              }}
              /
              {{
                selectedLeave
                  .total_sessions
              }}
            </p>
          </section>

          <!-- Date -->

          <label>
            <span>
              補課日期
            </span>

            <input
              v-model="
                form.makeupDate
              "
              type="date"
              required
              :disabled="
                creating
              "
            >

            <small
              v-if="
                selectedLeave
              "
            >
              此課堂固定為
              {{
                weekdayMap[
                  Number(
                    selectedLeave.weekday
                  )
                ]
              }}
              ，補課日期也必須選擇該課堂可上課日期。
            </small>
          </label>

          <!-- Note -->

          <label>
            <span>
              備註
            </span>

            <textarea
              v-model="
                form.note
              "
              rows="3"
              maxlength="2000"
              placeholder="選填..."
              :disabled="
                creating
              "
            />
          </label>

          <!-- Important -->

          <section class="dialog-rule">
            <strong>
              建立後會 +1 堂
            </strong>

            <p>
              這不是預約而已。建立補課代表這堂補課已實際出席，因此系統會建立 MAKEUP + ATTENDED 並立即累加方案堂數。
            </p>
          </section>

          <footer>
            <button
              type="button"
              :disabled="
                creating
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
                creating ||
                !form
                  .sourceLeaveAttendanceId ||
                !form.makeupDate
              "
            >
              {{
                creating
                  ? '建立中...'
                  : '確認補課'
              }}
            </button>
          </footer>
        </form>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.makeup-page {
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

.create-button:disabled {
  opacity: 0.4;
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
   Message
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
  color: #418b4b;
}

/* ============================================================
   Section
   ============================================================ */

.section {
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

/* ============================================================
   Leave
   ============================================================ */

.leave-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 9px;
}

.leave-list article {
  display: grid;
  grid-template-columns:
    2fr
    1fr;
  gap: 10px;
  padding: 11px;
  background: #ffffff;
  border-radius: 11px;
}

.leave-list article > div:last-child {
  text-align: right;
}

.leave-list span {
  display: block;
  color: #999999;
  font-size: 7px;
}

.leave-list strong {
  display: block;
  margin-top: 3px;
  font-size: 10px;
}

.leave-list small {
  display: block;
  margin-top: 3px;
  color: #888888;
  font-size: 7px;
}

/* ============================================================
   Makeup
   ============================================================ */

.makeup-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 9px;
}

.empty-state {
  margin-top: 9px;
  padding: 27px;
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
  max-width: 460px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  padding: 19px;
  background: #ffffff;
  border-radius: 19px;
}

.dialog > header {
  display: flex;
  justify-content: space-between;
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

.dialog label > span {
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

.dialog small {
  color: #999999;
  font-size: 7px;
  line-height: 1.5;
}

.leave-preview {
  margin-top: 10px;
  padding: 11px;
  background: #f7f7f7;
  border-radius: 10px;
}

.leave-preview > span {
  color: #999999;
  font-size: 7px;
}

.leave-preview strong {
  display: block;
  margin-top: 4px;
}

.leave-preview p {
  margin: 4px 0 0;
  color: #777777;
  font-size: 8px;
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
  line-height: 1.6;
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
  opacity: 0.4;
}
</style>