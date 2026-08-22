<script setup>
const attendanceStore =
  useAttendanceStore()

const {
  course,
  attendedCount,
  remainingSessions,
  progressPercentage,
  sortedAttendanceRecords,

  addTodayAttendance,
  addTodayLeave,
  cancelRecord,
} = useAttendance()

const message = ref('')
const showMessage = ref(false)

const showConfirmDialog = ref(false)

const pendingRecordId = ref(null)

const confirmConfig = ref({
  type: '',
  title: '',
  message: '',
  confirmText: '確認',
  danger: false,
})

let toastTimer = null

const showToast = (text) => {
  message.value = text
  showMessage.value = true

  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }

  toastTimer = window.setTimeout(() => {
    showMessage.value = false
  }, 2000)
}

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

  showConfirmDialog.value = true
}

/**
 * 取得某一天中午 12:00 的時間
 *
 * 例如：
 * 2026-08-22
 *
 * 會轉成：
 * 2026-08-22 12:00:00
 */
const getCancelDeadline = (dateString) => {
  if (!dateString) {
    return null
  }

  const deadline =
    new Date(`${dateString}T12:00:00`)

  if (
    Number.isNaN(
      deadline.getTime()
    )
  ) {
    return null
  }

  return deadline
}

/**
 * 判斷紀錄目前是否還能取消
 *
 * 規則：
 * 紀錄日期當天中午 12:00 前可以取消。
 * 12:00 起即不可取消。
 */
const canCancelRecord = (record) => {
  if (!record) {
    return false
  }

  if (
    record.status === 'CANCELLED'
  ) {
    return false
  }

  const deadline =
    getCancelDeadline(record.date)

  if (!deadline) {
    return false
  }

  const now = new Date()

  return now < deadline
}

const handleAttendance = () => {
  openConfirmDialog({
    type: 'ATTENDANCE',
    title: '確認上課',
    message:
      '確定要新增今天的上課紀錄嗎？新增後會計入本期堂數。',
    confirmText: '確認上課',
  })
}

const handleLeave = () => {
  openConfirmDialog({
    type: 'LEAVE',
    title: '確認請假',
    message:
      '確定要新增今天的請假紀錄嗎？本次不會計入已上課堂數。',
    confirmText: '確認請假',
  })
}

/**
 * 點擊紀錄旁邊的「取消」
 */
const handleCancelRecord = (id) => {
  const record =
    sortedAttendanceRecords.value.find(
      (item) => item.id === id
    )

  if (!record) {
    showToast(
      '找不到這筆紀錄'
    )

    return
  }

  if (
    record.status === 'CANCELLED'
  ) {
    showToast(
      '這筆紀錄已經取消'
    )

    return
  }

  if (!canCancelRecord(record)) {
    showToast(
      '已超過取消期限，當天中午 12:00 後無法取消紀錄'
    )

    return
  }

  pendingRecordId.value = id

  openConfirmDialog({
    type: 'CANCEL_RECORD',
    title: '取消紀錄',
    message:
      '確定要取消這筆紀錄嗎？取消後不會計入堂數，但紀錄仍會保留。',
    confirmText: '確認取消',
    danger: true,
  })
}

/**
 * 確認視窗按下「確認」
 */
const handleConfirmAction = () => {
  let result = null

  switch (
    confirmConfig.value.type
  ) {
    case 'ATTENDANCE':
      result =
        addTodayAttendance()

      break

    case 'LEAVE':
      result =
        addTodayLeave()

      break

    case 'CANCEL_RECORD': {
      const record =
        sortedAttendanceRecords.value.find(
          (item) =>
            item.id ===
            pendingRecordId.value
        )

      /**
       * 使用者可能在 11:59 打開確認視窗，
       * 但 12:00 之後才按「確認取消」。
       *
       * 所以真正執行取消前，
       * 再檢查一次期限。
       */
      if (
        !record ||
        !canCancelRecord(record)
      ) {
        result = {
          success: false,
          message:
            '已超過取消期限，當天中午 12:00 後無法取消紀錄',
        }

        pendingRecordId.value =
          null

        break
      }

      result =
        cancelRecord(
          pendingRecordId.value
        )

      pendingRecordId.value =
        null

      break
    }
  }

  showConfirmDialog.value = false

  if (result) {
    showToast(
      result.message
    )
  }
}

/**
 * 關閉確認視窗
 */
const handleCancelConfirm = () => {
  showConfirmDialog.value = false
  pendingRecordId.value = null
}

onBeforeUnmount(() => {
  if (toastTimer) {
    window.clearTimeout(
      toastTimer
    )
  }
})
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
          <img
            src="/favicon.png"
            alt="Tap Dance"
          >
        </div>
      </header>

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

      <CourseQuickActions
        @attendance="
          handleAttendance
        "
        @leave="
          handleLeave
        "
      />

      <AttendanceList
        :records="
          sortedAttendanceRecords
        "
        @cancel="
          handleCancelRecord
        "
      />
    </div>

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
                @click="
                  handleConfirmAction
                "
              >
                {{
                  confirmConfig.confirmText
                }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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
  padding: 24px 16px 50px;
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

.avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

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
    0 auto 16px;
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
  margin: 12px 0 0;
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
    10px 16px;
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

.dialog__button:active {
  transform:
    scale(0.97);
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

.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  z-index: 1100;
  max-width:
    calc(100vw - 32px);
  padding:
    11px 20px;
  background:
    rgb(20 20 20 / 92%);
  border-radius: 999px;
  color: #ffffff;
  font-size: 14px;
  text-align: center;
  white-space: normal;
  transform:
    translateX(-50%);
}

.dialog-enter-active,
.dialog-leave-active {
  transition:
    opacity 0.2s ease;
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
