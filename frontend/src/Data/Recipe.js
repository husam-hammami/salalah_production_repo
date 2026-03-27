export const recipeFormConfig = {
    title: 'Recipe Management',
    recipeControl:[
      { name: 'jobTypeId', label: 'Job Type Select: ', type: 'select' },
      { name: 'recipeId', label: 'Select Recipe', type: 'select' },
    ],
    recipeData: [
      {
        name: 'id',
        label: 'ID',
        type: 'text',
        disabled: true,
        className: '!w-24',
      },      
      { name: 'finalProductId', label: 'Final Product:', type: 'select' },
    ],

    description: [
      { name: 'jobQti', label: 'Job Quantity' },
      { name: 'fullDest', label: 'Full Destination' },
      { name: 'emptySource', label: 'Empty Source' },
      { name: 'heldStatus', label: 'Held Status' },
    ],

    delays: [
      { name: 'heldStatusDelay', label: 'Held Status Delay:', type: 'number' },
      { name: 'autoStopDelay', label: 'Auto Stop Delay:', type: 'number' },
    ],    
  };

