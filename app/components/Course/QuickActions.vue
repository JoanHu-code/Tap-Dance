<script setup>
const emit = defineEmits([
  'attendance',
  'leave',
])
</script>

<template>
  <section class="actions">
    <button
      class="action-button action-button--primary"
      @click="emit('attendance')"
    >
      <span class="action-button__icon">
        ✓
      </span>

      <span>
        今天有上課
      </span>
    </button>

    <button
      class="action-button"
      @click="emit('leave')"
    >
      <span class="action-button__icon">
        💤
      </span>

      <span>
        今天請假
      </span>
    </button>
  </section>
</template>

<style scoped>
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.action-button {
  min-height: 64px;
  padding: 12px 16px;
  border: 0;
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 5px 20px rgb(0 0 0 / 5%);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.action-button--primary {
  background: #222222;
  color: #ffffff;
}

.action-button__icon {
  margin-right: 6px;
}
</style>