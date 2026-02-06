import { toast } from "@/hooks/use-toast"

/**
 * Toast notification utility functions for consistent messaging across the app
 */

export const showSuccessToast = (title: string, description?: string) => {
  toast({
    title,
    description,
  })
}

export const showErrorToast = (title: string, description?: string) => {
  toast({
    variant: "destructive",
    title,
    description,
  })
}

export const showInfoToast = (title: string, description?: string) => {
  toast({
    title,
    description,
  })
}

/**
 * Pre-configured toast messages for common authentication scenarios
 */
export const authToasts = {
  signInSuccess: () => showSuccessToast(
    "Welcome back!",
    "You have successfully signed in. Redirecting..."
  ),

  signInError: (message?: string) => showErrorToast(
    "Authentication Failed",
    message || "Unable to sign in. Please check your credentials."
  ),

  signOutSuccess: () => showSuccessToast(
    "Signed out",
    "You have been successfully signed out."
  ),

  sessionExpired: () => showErrorToast(
    "Session Expired",
    "Your session has expired. Please sign in again."
  ),

  unauthorized: () => showErrorToast(
    "Unauthorized",
    "You don't have permission to access this resource."
  ),

  accountInactive: () => showErrorToast(
    "Account Inactive",
    "Your account has been deactivated. Please contact support."
  ),
}

/**
 * Pre-configured toast messages for common API operations
 */
export const apiToasts = {
  createSuccess: (resource: string) => showSuccessToast(
    "Created",
    `${resource} has been created successfully.`
  ),

  updateSuccess: (resource: string) => showSuccessToast(
    "Updated",
    `${resource} has been updated successfully.`
  ),

  deleteSuccess: (resource: string) => showSuccessToast(
    "Deleted",
    `${resource} has been deleted successfully.`
  ),

  saveSuccess: () => showSuccessToast(
    "Saved",
    "Your changes have been saved successfully."
  ),

  operationError: (operation?: string) => showErrorToast(
    "Operation Failed",
    operation ? `Failed to ${operation}. Please try again.` : "Something went wrong. Please try again."
  ),

  networkError: () => showErrorToast(
    "Network Error",
    "Unable to connect to the server. Please check your connection."
  ),

  validationError: (message?: string) => showErrorToast(
    "Validation Error",
    message || "Please check your input and try again."
  ),
}

/**
 * Pre-configured toast messages for common form operations
 */
export const formToasts = {
  submitSuccess: () => showSuccessToast(
    "Success",
    "Form submitted successfully."
  ),

  submitError: () => showErrorToast(
    "Submission Failed",
    "Unable to submit the form. Please try again."
  ),

  validationError: () => showErrorToast(
    "Validation Error",
    "Please fill in all required fields correctly."
  ),
}

/**
 * Pre-configured toast messages for file operations
 */
export const fileToasts = {
  uploadSuccess: (fileName?: string) => showSuccessToast(
    "Upload Complete",
    fileName ? `${fileName} uploaded successfully.` : "File uploaded successfully."
  ),

  uploadError: (fileName?: string) => showErrorToast(
    "Upload Failed",
    fileName ? `Failed to upload ${fileName}.` : "File upload failed. Please try again."
  ),

  deleteSuccess: (fileName?: string) => showSuccessToast(
    "File Deleted",
    fileName ? `${fileName} has been deleted.` : "File deleted successfully."
  ),

  deleteError: () => showErrorToast(
    "Delete Failed",
    "Unable to delete file. Please try again."
  ),
}
