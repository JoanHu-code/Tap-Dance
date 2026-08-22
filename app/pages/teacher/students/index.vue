<script setup>
definePageMeta({
  middleware: 'teacher-auth',
})

const loading = ref(true)
const saving = ref(false)

const errorMessage = ref('')
const successMessage = ref('')

const students = ref([])

const search = ref('')
const linkedFilter = ref('ALL')

const showCreateDialog = ref(false)

const form = reactive({
  name: '',
})

let searchTimer = null
let messageTimer = null

const total = computed(() => {
  return students.value.length
})

const linkedCount = computed(() => {
  return students.value.filter(
    (student) => {
      return Boolean(
        student.user_id
      )
    }
  ).length
})

const unlinkedCount = computed(() => {
  return (
    total.value -
    linkedCount.value
  )
})

const getStudentName = (
  student
) => {
  return (
    student?.name ||
    `學生 #${student?.id}`
  )
}

const showSuccess = (
  text
) => {
  successMessage.value =
    text

  if (messageTimer) {
    window.clearTimeout(
      messageTimer
    )
  }

  messageTimer =
    window.setTimeout(
      () => {
        successMessage.value =
          ''
      },
      2200
    )
}

const fetchStudents =
  async () => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const query = {}

      if (
        search.value.trim()
      ) {
        query.search =
          search.value.trim()
      }

      if (
        linkedFilter.value ===
        'LINKED'
      ) {
        query.linked =
          'true'
      }

      if (
        linkedFilter.value ===
        'UNLINKED'
      ) {
        query.linked =
          'false'
      }

      const response =
        await $fetch(
          '/api/teacher/students',
          {
            query,
          }
        )

      students.value =
        response?.students ||
        []
    } catch (error) {
      console.error(
        '取得學生列表失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '學生列表載入失敗'
    } finally {
      loading.value =
        false
    }
  }

const resetForm =
  () => {
    form.name = ''
  }

const openCreateDialog =
  () => {
    resetForm()

    errorMessage.value =
      ''

    showCreateDialog.value =
      true
  }

const closeCreateDialog =
  () => {
    if (
      saving.value
    ) {
      return
    }

    showCreateDialog.value =
      false

    resetForm()
  }

const createStudent =
  async () => {
    if (
      saving.value
    ) {
      return
    }

    const name =
      form.name.trim()

    if (!name) {
      errorMessage.value =
        '請輸入學生姓名'

      return
    }

    saving.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          '/api/teacher/students',
          {
            method: 'POST',

            body: {
              name,
            },
          }
        )

      showCreateDialog.value =
        false

      resetForm()

      showSuccess(
        response?.message ||
        '學生建立成功'
      )

      await fetchStudents()
    } catch (error) {
      console.error(
        '建立學生失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '建立學生失敗'
    } finally {
      saving.value =
        false
    }
  }

const handleSearch =
  () => {
    if (searchTimer) {
      window.clearTimeout(
        searchTimer
      )
    }

    searchTimer =
      window.setTimeout(
        async () => {
          await fetchStudents()
        },
        350
      )
  }

const handleFilterChange =
  async () => {
    await fetchStudents()
  }

const clearSearch =
  async () => {
    search.value = ''

    await fetchStudents()
  }

onMounted(
  async () => {
    await fetchStudents()
  }
)

onBeforeUnmount(
  () => {
    if (searchTimer) {
      window.clearTimeout(
        searchTimer
      )
    }

    if (messageTimer) {
      window.clearTimeout(
        messageTimer
      )
    }
  }
)
</script>

<template>
  <main class="students-page">
    <div class="students-container">
      <header class="page-header">
        <div>
          <NuxtLink
            to="/teacher"
            class="back-link"
          >
            ← 管理首頁
          </NuxtLink>

          <span class="eyebrow">
            Students
          </span>

          <h1>
            學生管理
          </h1>

          <p>
            管理學生基本資料、LINE 綁定與課程狀況。
          </p>
        </div>

        <button
          type="button"
          class="create-button"
          @click="openCreateDialog"
        >
          ＋ 新增學生
        </button>
      </header>

      <section class="summary-grid">
        <article class="summary-card">
          <span>
            學生總數
          </span>

          <strong>
            {{ total }}
          </strong>
        </article>

        <article class="summary-card">
          <span>
            LINE 已綁定
          </span>

          <strong>
            {{ linkedCount }}
          </strong>
        </article>

        <article class="summary-card">
          <span>
            尚未綁定
          </span>

          <strong>
            {{ unlinkedCount }}
          </strong>
        </article>
      </section>

      <section class="toolbar">
        <div class="search-box">
          <span class="search-box__icon">
            ⌕
          </span>

          <input
            v-model="search"
            type="search"
            placeholder="搜尋學生姓名"
            @input="handleSearch"
          >

          <button
            v-if="search"
            type="button"
            class="search-box__clear"
            @click="clearSearch"
          >
            ×
          </button>
        </div>

        <select
          v-model="linkedFilter"
          class="filter-select"
          @change="handleFilterChange"
        >
          <option value="ALL">
            全部學生
          </option>

          <option value="LINKED">
            LINE 已綁定
          </option>

          <option value="UNLINKED">
            尚未綁定
          </option>
        </select>

        <button
          type="button"
          class="refresh-button"
          :disabled="loading"
          @click="fetchStudents"
        >
          重新整理
        </button>
      </section>

      <div
        v-if="errorMessage"
        class="
          message
          message--error
        "
      >
        {{ errorMessage }}
      </div>

      <section class="student-panel">
        <div
          v-if="loading"
          class="loading-state"
        >
          <div class="loader" />

          <span>
            正在載入學生資料
          </span>
        </div>

        <div
          v-else-if="
            !students.length
          "
          class="empty-state"
        >
          <div class="empty-state__icon">
            人
          </div>

          <h2>
            找不到學生
          </h2>

          <p
            v-if="
              search ||
              linkedFilter !==
                'ALL'
            "
          >
            沒有符合目前搜尋條件的學生。
          </p>

          <p v-else>
            目前尚未建立任何學生。
          </p>

          <button
            v-if="
              !search &&
              linkedFilter ===
                'ALL'
            "
            type="button"
            class="create-button"
            @click="openCreateDialog"
          >
            建立第一位學生
          </button>
        </div>

        <div
          v-else
          class="student-list"
        >
          <NuxtLink
            v-for="
              student in
                students
            "
            :key="student.id"
            :to="
              `/teacher/students/${student.id}`
            "
            class="student-row"
          >
            <div class="student-avatar">
              {{
                getStudentName(
                  student
                ).slice(0, 1)
              }}
            </div>

            <div class="student-main">
              <strong>
                {{
                  getStudentName(
                    student
                  )
                }}
              </strong>

              <span>
                學生 ID：
                {{ student.id }}
              </span>
            </div>

            <div class="student-binding">
              <span
                class="binding-badge"
                :class="{
                  'binding-badge--linked':
                    student.user_id,
                }"
              >
                {{
                  student.user_id
                    ? 'LINE 已綁定'
                    : '尚未綁定'
                }}
              </span>
            </div>

            <span class="student-arrow">
              ›
            </span>
          </NuxtLink>
        </div>
      </section>
    </div>

    <Teleport to="body">
      <Transition name="dialog">
        <div
          v-if="
            showCreateDialog
          "
          class="dialog-mask"
          @click.self="
            closeCreateDialog
          "
        >
          <form
            class="dialog"
            @submit.prevent="
              createStudent
            "
          >
            <div class="dialog__header">
              <div>
                <span>
                  New Student
                </span>

                <h2>
                  新增學生
                </h2>
              </div>

              <button
                type="button"
                class="dialog__close"
                :disabled="saving"
                @click="
                  closeCreateDialog
                "
              >
                ×
              </button>
            </div>

            <div class="form-group">
              <label for="student-name">
                學生姓名
                <span>*</span>
              </label>

              <input
                id="student-name"
                v-model="form.name"
                type="text"
                maxlength="100"
                autocomplete="off"
                placeholder="例如：王美玲"
              >

              <small>
                建立學生時只需要姓名，LINE 可以之後再綁定。
              </small>
            </div>

            <div class="dialog__actions">
              <button
                type="button"
                class="secondary-button"
                :disabled="saving"
                @click="
                  closeCreateDialog
                "
              >
                取消
              </button>

              <button
                type="submit"
                class="primary-button"
                :disabled="
                  saving ||
                  !form.name.trim()
                "
              >
                {{
                  saving
                    ? '建立中...'
                    : '建立學生'
                }}
              </button>
            </div>
          </form>
        </div>
      </Transition>
    </Teleport>

    <Transition name="toast">
      <div
        v-if="successMessage"
        class="toast"
      >
        {{ successMessage }}
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.students-page {
  min-height: 100vh;
  padding: 28px 20px 60px;
  background: #f6f6f6;
  color: #222222;
}

.students-container {
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.back-link {
  display: block;
  margin-bottom: 18px;
  color: #777777;
  font-size: 12px;
  text-decoration: none;
}

.eyebrow {
  color: #999999;
  font-size: 12px;
  letter-spacing: 1.1px;
}

.page-header h1 {
  margin: 4px 0 0;
  font-size: 28px;
}

.page-header p {
  margin: 7px 0 0;
  color: #888888;
  font-size: 13px;
}

.create-button {
  min-height: 44px;
  padding: 10px 17px;
  border: 0;
  background: #222222;
  border-radius: 14px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.summary-grid {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      minmax(0, 1fr)
    );
  gap: 14px;
  margin-top: 24px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  min-height: 112px;
  padding: 18px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 20px;
}

.summary-card span {
  color: #888888;
  font-size: 12px;
}

.summary-card strong {
  margin-top: auto;
  font-size: 27px;
}

.toolbar {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.search-box {
  position: relative;
  flex: 1;
}

.search-box input {
  width: 100%;
  height: 46px;
  padding:
    0
    42px;
  border: 1px solid #e5e5e5;
  outline: none;
  background: #ffffff;
  border-radius: 14px;
  font-size: 13px;
}

.search-box__icon {
  position: absolute;
  top: 50%;
  left: 15px;
  color: #999999;
  transform:
    translateY(-50%);
}

.search-box__clear {
  position: absolute;
  top: 50%;
  right: 10px;
  width: 28px;
  height: 28px;
  border: 0;
  background: transparent;
  color: #999999;
  font-size: 20px;
  cursor: pointer;
  transform:
    translateY(-50%);
}

.filter-select,
.refresh-button {
  height: 46px;
  padding:
    0
    14px;
  border: 1px solid #e5e5e5;
  background: #ffffff;
  border-radius: 14px;
  color: #555555;
  font-size: 12px;
}

.refresh-button {
  cursor: pointer;
}

.student-panel {
  margin-top: 16px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 24px;
}

.student-list {
  padding:
    4px
    18px;
}

.student-row {
  display: flex;
  align-items: center;
  gap: 13px;
  min-height: 78px;
  padding:
    10px
    4px;
  border-bottom: 1px solid #f0f0f0;
  color: inherit;
  text-decoration: none;
}

.student-row:last-child {
  border-bottom: 0;
}

.student-avatar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 45px;
  height: 45px;
  background: #f1f1f1;
  border-radius: 15px;
  font-size: 14px;
  font-weight: 700;
}

.student-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.student-main strong {
  font-size: 14px;
}

.student-main span {
  margin-top: 5px;
  color: #999999;
  font-size: 11px;
}

.binding-badge {
  display: inline-flex;
  padding:
    6px
    10px;
  background: #f3f3f3;
  border-radius: 999px;
  color: #999999;
  font-size: 11px;
}

.binding-badge--linked {
  background: #eef8ee;
  color: #4d9651;
}

.student-arrow {
  color: #bbbbbb;
  font-size: 22px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
}

.loader {
  width: 38px;
  height: 38px;
  margin-bottom: 15px;
  border: 4px solid #eeeeee;
  border-top-color: #222222;
  border-radius: 50%;
  animation:
    loading
    0.75s
    linear infinite;
}

.empty-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 55px;
  height: 55px;
  background: #f1f1f1;
  border-radius: 18px;
}

.empty-state h2 {
  margin: 17px 0 0;
}

.empty-state p {
  color: #999999;
  font-size: 12px;
}

.message {
  margin-top: 14px;
  padding: 12px;
  border-radius: 13px;
}

.message--error {
  background: #fff0f0;
  color: #c94343;
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
}

.dialog {
  width: 100%;
  max-width: 420px;
  padding: 24px;
  background: #ffffff;
  border-radius: 24px;
}

.dialog__header {
  display: flex;
  justify-content: space-between;
}

.dialog__header span {
  color: #999999;
  font-size: 10px;
}

.dialog__header h2 {
  margin: 4px 0 0;
}

.dialog__close {
  width: 34px;
  height: 34px;
  border: 0;
  background: #f3f3f3;
  border-radius: 50%;
  font-size: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-top: 20px;
}

.form-group label {
  margin-bottom: 7px;
  font-size: 12px;
  font-weight: 600;
}

.form-group label span {
  color: #d94a4a;
}

.form-group input {
  height: 46px;
  padding:
    0
    13px;
  border: 1px solid #dddddd;
  border-radius: 13px;
  box-sizing: border-box;
}

.form-group small {
  margin-top: 8px;
  color: #999999;
  font-size: 11px;
}

.dialog__actions {
  display: grid;
  grid-template-columns:
    1fr 1fr;
  gap: 10px;
  margin-top: 25px;
}

.secondary-button,
.primary-button {
  min-height: 46px;
  border: 0;
  border-radius: 14px;
  font-weight: 600;
}

.secondary-button {
  background: #f1f1f1;
}

.primary-button {
  background: #222222;
  color: #ffffff;
}

.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  z-index: 1100;
  padding:
    11px
    20px;
  background:
    rgb(20 20 20 / 92%);
  border-radius: 999px;
  color: #ffffff;
  transform:
    translateX(-50%);
}

@keyframes loading {
  to {
    transform:
      rotate(360deg);
  }
}

@media (
  max-width: 700px
) {
  .students-page {
    padding:
      18px
      14px
      40px;
  }

  .toolbar {
    flex-wrap: wrap;
  }

  .search-box {
    flex:
      0 0 100%;
  }

  .filter-select {
    flex: 1;
  }

  .student-binding {
    display: none;
  }
}

@media (
  max-width: 480px
) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .create-button {
    width: 100%;
  }
}
</style>