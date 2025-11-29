"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Plus, Trash2, Users, Building2 } from "lucide-react"
import { useAdminUsers, useCreateAdminUser, useDeleteAdminUser } from "./admin-hooks"
import { createUserSchema } from "@/lib/validation/admin-schemas"
import { useToast } from "@/hooks/use-toast"
import type { User, UserOrganization } from "./admin-types"

export function AdminUsersTab() {
  const { data: users = [], isLoading } = useAdminUsers()
  const createUserMutation = useCreateAdminUser()
  const deleteUserMutation = useDeleteAdminUser()
  const { toast } = useToast()
  
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleCreateUser = async () => {
    // Validate input
    const result = createUserSchema.safeParse(newUser)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message
        }
      })
      setErrors(fieldErrors)
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive"
      })
      return
    }
    
    setErrors({})
    await createUserMutation.mutateAsync(result.data)
    setNewUser({ email: '', password: '', name: '' })
    setUserDialogOpen(false)
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This will also delete all their jobs and results.')) {
      return
    }
    await deleteUserMutation.mutateAsync(userId)
  }

  // Group users by organization
  const usersByOrg = new Map<string, { org: UserOrganization; users: User[] }>()
  const usersWithoutOrg: User[] = []

  users.forEach((user) => {
    // Parse organizations if it's a string (from JSON aggregation)
    let orgs: UserOrganization[] = []
    try {
      if (typeof user.organizations === 'string') {
        orgs = JSON.parse(user.organizations)
      } else if (Array.isArray(user.organizations)) {
        orgs = user.organizations
      }
    } catch (e) {
      console.error('Error parsing organizations:', e)
      orgs = []
    }

    // Filter out null/undefined organizations
    orgs = orgs.filter((org: UserOrganization) => org && org.id)

    if (orgs.length === 0) {
      usersWithoutOrg.push(user)
    } else {
      orgs.forEach((org: UserOrganization) => {
        if (!usersByOrg.has(org.id)) {
          usersByOrg.set(org.id, { org, users: [] })
        }
        usersByOrg.get(org.id)!.users.push(user)
      })
    }
  })

  const orgEntries = Array.from(usersByOrg.entries())

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading users...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Add, view, and delete users</CardDescription>
        </div>
        <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => {
                    setNewUser(prev => ({ ...prev, email: e.target.value }))
                    if (errors.email) setErrors(prev => ({ ...prev, email: '' }))
                  }}
                  placeholder="user@example.com"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                {errors.email && (
                  <p id="email-error" className="text-sm text-destructive mt-1">{errors.email}</p>
                )}
              </div>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) => {
                    setNewUser(prev => ({ ...prev, name: e.target.value }))
                    if (errors.name) setErrors(prev => ({ ...prev, name: '' }))
                  }}
                  placeholder="John Doe"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                />
                {errors.name && (
                  <p id="name-error" className="text-sm text-destructive mt-1">{errors.name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => {
                    setNewUser(prev => ({ ...prev, password: e.target.value }))
                    if (errors.password) setErrors(prev => ({ ...prev, password: '' }))
                  }}
                  placeholder="Enter password (min 8 characters)"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />
                {errors.password && (
                  <p id="password-error" className="text-sm text-destructive mt-1">{errors.password}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending || !newUser.email || !newUser.password || !newUser.name}
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No users found</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {/* Users grouped by organization */}
            {orgEntries.map(([orgId, { org, users: orgUsers }]) => (
              <AccordionItem key={orgId} value={orgId} className="border rounded-lg mb-2 px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2 flex-1">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{org.name}</span>
                    <Badge variant="outline" className="ml-2">
                      {orgUsers.length} {orgUsers.length === 1 ? 'user' : 'users'}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    {orgUsers.map((user) => {
                      let userOrgs: UserOrganization[] = []
                      try {
                        if (typeof user.organizations === 'string') {
                          userOrgs = JSON.parse(user.organizations)
                        } else if (Array.isArray(user.organizations)) {
                          userOrgs = user.organizations
                        }
                      } catch (e) {
                        userOrgs = []
                      }
                      const userOrg = userOrgs.find((o: UserOrganization) => o && o.id === orgId)

                      return (
                        <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{user.name}</p>
                              {userOrg && (
                                <Badge variant={userOrg.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                                  {userOrg.role}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            <p className="text-xs text-muted-foreground">
                              Created: {new Date(user.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={deleteUserMutation.isPending}
                            className="flex items-center gap-1"
                            aria-label={`Delete user ${user.name}`}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}

            {/* Users without organization */}
            {usersWithoutOrg.length > 0 && (
              <AccordionItem value="no-org" className="border rounded-lg mb-2 px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2 flex-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">No Organization</span>
                    <Badge variant="outline" className="ml-2">
                      {usersWithoutOrg.length} {usersWithoutOrg.length === 1 ? 'user' : 'users'}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    {usersWithoutOrg.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Created: {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={deleteUserMutation.isPending}
                          className="flex items-center gap-1"
                          aria-label={`Delete user ${user.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}
      </CardContent>
    </Card>
  )
}

