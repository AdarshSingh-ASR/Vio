'use client'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
type Props = {
    trigger: React.ReactNode
    children: React.ReactNode,
    title: string,
    description: string,
    className?: string
}
export default function ModalComponent({trigger, children, title, description, className}: Props) {
    return (
        <Dialog>
            <DialogTrigger className={className} asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    )
}