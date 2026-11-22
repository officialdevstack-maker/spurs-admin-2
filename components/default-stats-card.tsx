import React from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


interface DefaultStatsCardProps {
    totalUsers: number;
    totalOidcUsers: number;
    totalAdminUsers: number;
}


// File: lib/utils.ts (or any shared utils file)

export function camelToTitle(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // insert space before capitals
    .replace(/^./, (char) => char.toUpperCase()); // capitalize first letter
}


const DefaultStatsCard = (props?: DefaultStatsCardProps) => {

    const remappedValues = Object.entries(props || {}).map(([key, value]) => {
        return {
            [camelToTitle(key)]: value
        }
    }).reduce((acc, curr) => ({ ...acc, ...curr }), {});
    
  return (
    <div>
         <Card>
          <CardContent className="grid grid-cols-3 gap-4 ">
          {
            Object.entries(remappedValues).map(([key, value]) => (
            <div className="border-r border-muted-foreground/50 last:border-r-0">
              <label htmlFor="value-1">
                {key}
              </label>
              <div id="value-1" className="text-xl md:text-2xl font-bold">
                {value}
              </div>
            </div>

            ))
          }

          </CardContent>
        </Card>
    </div>
  )
}

export default DefaultStatsCard