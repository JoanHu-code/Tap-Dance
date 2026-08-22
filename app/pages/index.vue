<script setup>
const {
  course,
  attendedCount,
  remainingSessions,
  progressPercentage,
  sortedAttendanceRecords,

  loading,
  submitting,
  error,

  addTodayAttendance,
  addTodayLeave,
  cancelRecord,
  refreshAttendance,
} = useAttendance()

// ============================================================
// Toast
// ============================================================

const message = ref('')
const showMessage = ref(false)

let toastTimer = null

const showToast = (text) => {
  message.value = text
  showMessage.value = true

  if (toastTimer) {
    window.clearTimeout(
      toastTimer
    )
  }

  toastTimer =
    window.setTimeout(
      () => {
        showMessage.value = false
      },
      2500
    )
}

// ============================================================
// 確認視窗
// ============================================================

const showConfirmDialog =
  ref(false)

const pendingRecordId =
  ref(null)

const confirmConfig =
  ref({
    type: '',
    title: '',
    message: '',
    confirmText: '確認',
    danger: false,
  })

const openConfirmDialog = ({
  type,
  title,
  message,
  confirmText = '確認',
  danger = false,
}) => {
  confirmConfig.value = {
    type,
    title,
    message,
    confirmText,
    danger,
  }

  showConfirmDialog.value =
    true
}

// ============================================================
// 上課
// ============================================================

const handleAttendance = () => {
  openConfirmDialog({
    type:
      'ATTENDANCE',

    title:
      '確認上課',

    message:
      '確定要新增今天的上課紀錄嗎？新增後會計入本期堂數。',

    confirmText:
      '確認上課',
  })
}

// ============================================================
// 請假
// ============================================================

const handleLeave = () => {
  openConfirmDialog({
    type:
      'LEAVE',

    title:
      '確認請假',

    message:
      '確定要新增今天的請假紀錄嗎？本次不會計入已上課堂數。',

    confirmText:
      '確認請假',
  })
}

// ============================================================
// 取消紀錄
// ============================================================

const handleCancelRecord = (
  id
) => {
  pendingRecordId.value =
    id

  openConfirmDialog({
    type:
      'CANCEL_RECORD',

    title:
      '取消紀錄',

    message:
      '確定要取消這筆紀錄嗎？取消後不會計入堂數，但紀錄仍會保留。當天中午 12:00 後無法取消。',

    confirmText:
      '確認取消',

    danger:
      true,
  })
}

// ============================================================
// 確認執行
// ============================================================

const handleConfirmAction =
  async () => {
    if (
      submitting.value
    ) {
      return
    }

    let result = null

    switch (
      confirmConfig.value.type
    ) {
      case 'ATTENDANCE':
        result =
          await addTodayAttendance()

        break

      case 'LEAVE':
        result =
          await addTodayLeave()

        break

      case 'CANCEL_RECORD':
        if (
          pendingRecordId.value ===
          null
        ) {
          result = {
            success: false,
            message:
              '找不到要取消的紀錄',
          }

          break
        }

        result =
          await cancelRecord(
            pendingRecordId.value
          )

        pendingRecordId.value =
          null

        break
    }

    showConfirmDialog.value =
      false

    if (result) {
      showToast(
        result.message
      )
    }
  }

// ============================================================
// 關閉確認視窗
// ============================================================

const handleCancelConfirm =
  () => {
    if (
      submitting.value
    ) {
      return
    }

    showConfirmDialog.value =
      false

    pendingRecordId.value =
      null
  }

// ============================================================
// 初始化
// ============================================================

onMounted(
  async () => {
    await refreshAttendance()

    if (error.value) {
      showToast(
        error.value
      )
    }
  }
)

// ============================================================
// 清除 Timer
// ============================================================

onBeforeUnmount(
  () => {
    if (toastTimer) {
      window.clearTimeout(
        toastTimer
      )
    }
  }
)
</script>

<template>
  <main class="home">
    <div class="home__container">
      <header class="home__header">
        <div>
          <span>
            Tap Dance
          </span>

          <h1>
            課程紀錄
          </h1>
        </div>

        <div class="avatar">
          👞
        </div>
      </header>

      <!-- 載入中 -->
      <div
        v-if="loading"
        class="loading-card"
      >
        <div
          class="loading-spinner"
        />

        <span>
          資料載入中...
        </span>
      </div>

      <template v-else>
        <!-- 課程進度 -->
        <CourseProgress
          :course-name="
            course.name
          "
          :attended-count="
            attendedCount
          "
          :total-sessions="
            course.totalSessions
          "
          :remaining-sessions="
            remainingSessions
          "
          :progress-percentage="
            progressPercentage
          "
          :price="
            course.price
          "
        />

        <!-- 快速操作 -->
        <CourseQuickActions
          @attendance="
            handleAttendance
          "
          @leave="
            handleLeave
          "
        />

        <!-- 上課 / 已取消 Tab -->
        <AttendanceList
          :records="
            sortedAttendanceRecords
          "
          @cancel="
            handleCancelRecord
          "
        />
      </template>
    </div>

    <!-- ======================================================
         確認視窗
         ====================================================== -->

    <Teleport to="body">
      <Transition name="dialog">
        <div
          v-if="
            showConfirmDialog
          "
          class="dialog-mask"
          @click.self="
            handleCancelConfirm
          "
        >
          <div class="dialog">
            <div
              class="dialog__icon"
              :class="{
                'dialog__icon--danger':
                  confirmConfig.danger,
              }"
            >
              {{
                confirmConfig.danger
                  ? '!'
                  : '?'
              }}
            </div>

            <h3
              class="dialog__title"
            >
              {{
                confirmConfig.title
              }}
            </h3>

            <p
              class="dialog__message"
            >
              {{
                confirmConfig.message
              }}
            </p>

            <div
              class="dialog__actions"
            >
              <button
                type="button"
                class="
                  dialog__button
                  dialog__button--cancel
                "
                :disabled="
                  submitting
                "
                @click="
                  handleCancelConfirm
                "
              >
                取消
              </button>

              <button
                type="button"
                class="
                  dialog__button
                "
                :class="{
                  'dialog__button--confirm':
                    !confirmConfig.danger,

                  'dialog__button--danger':
                    confirmConfig.danger,
                }"
                :disabled="
                  submitting
                "
                @click="
                  handleConfirmAction
                "
              >
                {{
                  submitting
                    ? '處理中...'
                    : confirmConfig.confirmText
                }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ======================================================
         Toast
         ====================================================== -->

    <Transition name="toast">
      <div
        v-if="showMessage"
        class="toast"
      >
        {{ message }}
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.home {
  min-height: 100vh;
  padding:
    24px
    16px
    50px;
  background: #f7f7f7;
}

.home__container {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
}

/* ============================================================
   Header
   ============================================================ */

.home__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px;
}

.home__header span {
  color: #999999;
  font-size: 13px;
  letter-spacing: 1px;
}

.home__header h1 {
  margin: 3px 0 0;
  color: #222222;
  font-size: 25px;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  background: #ffffff;
  border-radius: 50%;
  box-shadow:
    0 5px 16px
    rgb(0 0 0 / 5%);
}

/* ============================================================
   Loading
   ============================================================ */

.loading-card {
  display: flex;
  min-height: 160px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 32px;
  background: #ffffff;
  border-radius: 24px;
  color: #999999;
  font-size: 14px;
  box-shadow:
    0 8px 30px
    rgb(0 0 0 / 5%);
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border:
    3px solid
    #eeeeee;
  border-top-color:
    #333333;
  border-radius: 50%;
  animation:
    spin 0.8s
    linear
    infinite;
}

@keyframes spin {
  to {
    transform:
      rotate(360deg);
  }
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
  padding: 20px;
  background:
    rgb(0 0 0 / 45%);
  backdrop-filter:
    blur(3px);
}

.dialog {
  width: 100%;
  max-width: 360px;
  padding:
    26px
    22px
    22px;
  background: #ffffff;
  border-radius: 24px;
  box-shadow:
    0 24px 70px
    rgb(0 0 0 / 20%);
  text-align: center;
}

.dialog__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  margin:
    0 auto
    16px;
  background: #f4f4f4;
  border-radius: 50%;
  color: #444444;
  font-size: 24px;
  font-weight: 700;
}

.dialog__icon--danger {
  background: #fff0f0;
  color: #d94a4a;
}

.dialog__title {
  margin: 0;
  color: #222222;
  font-size: 21px;
}

.dialog__message {
  margin:
    12px
    0
    0;
  color: #666666;
  font-size: 14px;
  line-height: 1.7;
}

.dialog__actions {
  display: grid;
  grid-template-columns:
    1fr 1fr;
  gap: 10px;
  margin-top: 24px;
}

.dialog__button {
  min-height: 46px;
  padding:
    10px
    16px;
  border: 0;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform
    0.15s ease,
    opacity
    0.15s ease;
}

.dialog__button:not(
  :disabled
):active {
  transform:
    scale(0.97);
}

.dialog__button:disabled {
  cursor:
    not-allowed;
  opacity: 0.55;
}

.dialog__button--cancel {
  background: #f1f1f1;
  color: #555555;
}

.dialog__button--confirm {
  background: #222222;
  color: #ffffff;
}

.dialog__button--danger {
  background: #d94a4a;
  color: #ffffff;
}

/* ============================================================
   Toast
   ============================================================ */

.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  z-index: 1100;
  max-width:
    calc(
      100vw - 32px
    );
  padding:
    11px
    20px;
  background:
    rgb(
      20 20 20 /
      92%
    );
  border-radius: 999px;
  color: #ffffff;
  font-size: 14px;
  text-align: center;
  white-space: normal;
  transform:
    translateX(-50%);
}

/* ============================================================
   Animation
   ============================================================ */

.dialog-enter-active,
.dialog-leave-active {
  transition:
    opacity
    0.2s ease;
}

.dialog-enter-active
.dialog,
.dialog-leave-active
.dialog {
  transition:
    transform
    0.2s ease,
    opacity
    0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from
.dialog,
.dialog-leave-to
.dialog {
  opacity: 0;
  transform:
    scale(0.94);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity
    0.2s ease,
    transform
    0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform:
    translate(
      -50%,
      10px
    );
}

/* ============================================================
   Mobile
   ============================================================ */

@media (
  max-width: 480px
) {
  .home {
    padding:
      18px
      14px
      40px;
  }

  .dialog {
    max-width: 100%;
  }
}
</style>