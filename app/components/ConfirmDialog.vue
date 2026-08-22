<script setup>
const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '確認操作',
  },
  message: {
    type: String,
    default: '',
  },
  confirmText: {
    type: String,
    default: '確認',
  },
  cancelText: {
    type: String,
    default: '取消',
  },
  danger: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'confirm',
  'cancel',
  'update:show',
])

const handleConfirm = () => {
  emit('confirm')
  emit('update:show', false)
}

const handleCancel = () => {
  emit('cancel')
  emit('update:show', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="show"
        class="dialog-mask"
        @click.self="handleCancel"
      >
        <div class="dialog">
          <h3 class="dialog__title">
            {{ title }}
          </h3>

          <p class="dialog__message">
            {{ message }}
          </p>

          <div class="dialog__actions">
            <button
              class="dialog__button dialog__button--cancel"
              @click="handleCancel"
            >
              {{ cancelText }}
            </button>

            <button
              class="dialog__button"
              :class="{
                'dialog__button--danger': danger,
                'dialog__button--confirm': !danger,
              }"
              @click="handleConfirm"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgb(0 0 0 / 40%);
}

.dialog {
  width: 100%;
  max-width: 360px;
  padding: 24px;
  background: #ffffff;
  border-radius: 22px;
  box-shadow: 0 20px 60px rgb(0 0 0 / 18%);
}

.dialog__title {
  margin: 0;
  font-size: 20px;
}

.dialog__message {
  margin: 12px 0 0;
  color: #666666;
  line-height: 1.7;
}

.dialog__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 24px;
}

.dialog__button {
  min-height: 46px;
  border: 0;
  border-radius: 14px;
  font-weight: 600;
  cursor: pointer;
}

.dialog__button--cancel {
  background: #f2f2f2;
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

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-active .dialog,
.dialog-leave-active .dialog {
  transition: transform 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .dialog,
.dialog-leave-to .dialog {
  transform: scale(0.96);
}
</style>