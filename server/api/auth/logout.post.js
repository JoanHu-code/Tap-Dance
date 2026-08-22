import {
  removeAuthSession,
} from '../../utils/authSession.js'

export default defineEventHandler(
  async (event) => {
    await removeAuthSession(
      event
    )

    return {
      success: true,
    }
  }
)